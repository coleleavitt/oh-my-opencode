import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { DelegateTaskArgs, DelegatedModelConfig, ToolContextWithMetadata, DelegateTaskToolOptions } from "./types"
import { CATEGORY_DESCRIPTIONS } from "./constants"
import { SISYPHUS_JUNIOR_AGENT } from "./sisyphus-junior-agent"
import { mergeCategories } from "../../shared/merge-categories"
import { log } from "../../shared/logger"
import { buildSystemContent } from "./prompt-builder"
import type {
  AvailableCategory,
  AvailableSkill,
} from "../../agents/dynamic-agent-prompt-builder"
import {
  resolveSkillContent,
  resolveParentContext,
  executeBackgroundContinuation,
  executeSyncContinuation,
  resolveCategoryExecution,
  resolveSubagentExecution,
  executeUnstableAgentTask,
  executeBackgroundTask,
  executeSyncTask,
} from "./executor"
import { withWorktree } from "./worktree"
import { getAgentConfigKey } from "../../shared/agent-display-names"
import { isAgentBackgroundCapable } from "../../agents/agent-capabilities"

export { resolveCategoryConfig } from "./categories"
export type { SyncSessionCreatedEvent, DelegateTaskToolOptions, BuildSystemContentInput } from "./types"
export { buildSystemContent, buildTaskPrompt } from "./prompt-builder"

export function createDelegateTask(options: DelegateTaskToolOptions): ToolDefinition {
  const { userCategories } = options

  const allCategories = mergeCategories(userCategories)
  const categoryNames = Object.keys(allCategories)
  const categoryExamples = categoryNames.join(", ")

  const availableCategories: AvailableCategory[] = options.availableCategories
    ?? Object.entries(allCategories).map(([name, categoryConfig]) => {
      const userDesc = userCategories?.[name]?.description
      const builtinDesc = CATEGORY_DESCRIPTIONS[name]
      const description = userDesc || builtinDesc || "General tasks"
      return {
        name,
        description,
        model: categoryConfig.model,
      }
    })

  const availableSkills: AvailableSkill[] = options.availableSkills ?? []

  const categoryList = categoryNames.map(name => {
    const userDesc = userCategories?.[name]?.description
    const builtinDesc = CATEGORY_DESCRIPTIONS[name]
    const desc = userDesc || builtinDesc
    return desc ? `  - ${name}: ${desc}` : `  - ${name}`
  }).join("\n")

  const description = `Spawn agent task with category-based or direct agent selection.
  
  ⚠️  CRITICAL: You MUST provide EITHER category OR subagent_type. Omitting BOTH will FAIL.
  
  **COMMON MISTAKE (DO NOT DO THIS):**
  \`\`\`
  task(description="...", prompt="...", run_in_background=false)  // ❌ FAILS - missing category AND subagent_type
  \`\`\`
  
  **CORRECT - Using category:**
  \`\`\`
  task(subagent_type="general", load_skills=[], description="Fix type error", prompt="...", run_in_background=false)
  \`\`\`
  
  **CORRECT - Using subagent_type:**
  \`\`\`
  task(subagent_type="explore", load_skills=[], description="Find patterns", prompt="...", run_in_background=true)
  \`\`\`
  
  REQUIRED: Provide ONE of:
  - category: For task delegation (uses Sisyphus-Junior with category-optimized model)
  - subagent_type: For direct agent invocation (explore, librarian, oracle, etc.)
  
  **DO NOT provide both.** If category is provided, subagent_type is ignored.
  
  - load_skills: ALWAYS REQUIRED. Pass [] if no skills needed, or ["skill-1", "skill-2"] for category tasks.
  - category: Use predefined category → Spawns Sisyphus-Junior with category config
    Available categories:
  ${categoryList}
  - subagent_type: Use specific agent directly (explore, librarian, oracle, metis, momus)
  - run_in_background: REQUIRED. true=async (returns task_id), false=sync (waits). Use background=true ONLY for parallel exploration with 5+ independent queries.
  - run_in_worktree: Optional. Run the delegated task inside a throwaway \`git worktree\` so the agent's mutations can't touch your working copy. Auto-cleans up if the agent produces no changes; if the agent makes commits or leaves a dirty tree, the branch + path are returned for you to review. Sync-only — ignored when run_in_background=true. Use when dispatching risky/experimental work you want to gate before merging.
  - teammate: Optional. Register the spawned agent as a named teammate you can message again across turns via send_message_to_teammate. Requires teammate_name. Sync-only — ignored when run_in_background=true. Capacity: 5 per session by default; reusing a name rebinds without consuming a slot.
  - teammate_name: Required with teammate=true. Stable short name you'll use to address the teammate later (e.g. "researcher", "reviewer").
  - session_id: Existing Task session to continue (from previous task output). Continues agent with FULL CONTEXT PRESERVED - saves tokens, maintains continuity.
  - command: The command that triggered this task (optional, for slash command tracking).
  
  **WHEN TO USE session_id:**
  - Task failed/incomplete → session_id with "fix: [specific issue]"
  - Need follow-up on previous result → session_id with additional question
  - Multi-turn conversation with same agent → always session_id instead of new task
  
  Prompts MUST be in English.`

  return tool({
    description,
    args: {
      load_skills: tool.schema.array(tool.schema.string()).describe("Skill names to inject. REQUIRED - pass [] if no skills needed."),
      description: tool.schema.string().optional().describe("Short task description (3-5 words). Auto-generated from prompt if omitted."),
      prompt: tool.schema.string().describe("Full detailed prompt for the agent"),
      run_in_background: tool.schema.boolean().describe("REQUIRED. true=async (returns task_id), false=sync (waits). Use false for task delegation, true ONLY for parallel exploration."),
      run_in_worktree: tool.schema.boolean().optional().describe("Optional. Run the task in a throwaway `git worktree` so mutations can't touch your working copy. Auto-cleans up if no changes are made; surfaces branch+path if changes are made. Sync-only — ignored when run_in_background=true."),
      teammate: tool.schema.boolean().optional().describe("Optional. Register the spawned agent as a named teammate you can continue messaging across turns via send_message_to_teammate. Requires teammate_name. Sync-only — ignored for run_in_background=true."),
      teammate_name: tool.schema.string().optional().describe("Stable name for the teammate (e.g. 'researcher', 'reviewer'). Required when teammate=true. Reusing a name rebinds it to a fresh session; new names count toward the per-session cap (default 5)."),
      category: tool.schema.string().optional().describe(`REQUIRED if subagent_type not provided. Do NOT provide both category and subagent_type.`),
      subagent_type: tool.schema.string().optional().describe("REQUIRED if category not provided. Do NOT provide both category and subagent_type."),
      session_id: tool.schema.string().optional().describe("Existing Task session to continue"),
      command: tool.schema.string().optional().describe("The command that triggered this task"),
    },
    async execute(args: DelegateTaskArgs, toolContext) {
      const ctx = toolContext as ToolContextWithMetadata

      if (args.category) {
        if (args.subagent_type && args.subagent_type.trim().length > 0) {
          // Phase C1 (cc119-async-fork-alias plan): respect both. Category sets the
          // model tier; subagent_type stays orthogonal. This decouples model-choice
          // from agent-choice — you can pair any agent (explore, librarian, fork...)
          // with any category. Backward-compat: when subagent_type is omitted,
          // category-only calls still fall back to sisyphus-junior below.
          log("[task] category + subagent_type both provided - keeping both (Phase C1)", {
            category: args.category,
            subagent_type: args.subagent_type,
          })
        } else {
          args.subagent_type = SISYPHUS_JUNIOR_AGENT
        }
      }
      // Auto-generate description from prompt when missing or empty
      if (!args.description || typeof args.description !== "string" || args.description.trim() === "") {
        const words = (args.prompt || "").trim().split(/\s+/)
        args.description = words.slice(0, 4).join(" ") || "Delegated task"
      }
      await ctx.metadata?.({
        title: args.description,
      })
      if (args.run_in_background === undefined) {
        throw new Error(`Invalid arguments: 'run_in_background' parameter is REQUIRED. Specify run_in_background=false for task delegation, or run_in_background=true for parallel exploration.`)
      }
      if (typeof args.load_skills === "string") {
        try {
          const parsed = JSON.parse(args.load_skills)
          args.load_skills = Array.isArray(parsed) ? parsed : []
        } catch {
          args.load_skills = []
        }
      }
      if (args.load_skills === undefined) {
        throw new Error(`Invalid arguments: 'load_skills' parameter is REQUIRED. Pass [] if no skills needed.`)
      }
      if (args.load_skills === null) {
        throw new Error(`Invalid arguments: load_skills=null is not allowed. Pass [] if no skills needed.`)
      }

      const runInBackground = args.run_in_background === true

      const { content: skillContent, contents: skillContents, error: skillError } = await resolveSkillContent(args.load_skills, {
        gitMasterConfig: options.gitMasterConfig,
        browserProvider: options.browserProvider,
        disabledSkills: options.disabledSkills,
        directory: options.directory,
      })
      if (skillError) {
        return skillError
      }

      const parentContext = await resolveParentContext(ctx, options.client)

      if (args.session_id) {
        if (runInBackground) {
          return executeBackgroundContinuation(args, ctx, options, parentContext)
        }
        return executeSyncContinuation(args, ctx, options)
      }

      if (!args.category && !args.subagent_type) {
        return `Invalid arguments: Must provide either category or subagent_type.`
      }

      let systemDefaultModel: string | undefined
      try {
        const openCodeConfig = await options.client.config.get()
        systemDefaultModel = (openCodeConfig as { data?: { model?: string } })?.data?.model
      } catch {
        systemDefaultModel = undefined
      }

      const inheritedModel = parentContext.model
        ? `${parentContext.model.providerID}/${parentContext.model.modelID}`
        : undefined

      let agentToUse: string
      let categoryModel: DelegatedModelConfig | undefined
      let categoryPromptAppend: string | undefined
      let modelInfo: import("../../features/task-toast-manager/types").ModelFallbackInfo | undefined
      let actualModel: string | undefined
      let isUnstableAgent = false
      let fallbackChain: import("../../shared/model-requirements").FallbackEntry[] | undefined
      let maxPromptTokens: number | undefined

      if (args.category) {
        const resolution = await resolveCategoryExecution(args, options, inheritedModel, systemDefaultModel)
        if (resolution.error) {
          return resolution.error
        }
        agentToUse = resolution.agentToUse
        categoryModel = resolution.categoryModel
        categoryPromptAppend = resolution.categoryPromptAppend
        modelInfo = resolution.modelInfo
        actualModel = resolution.actualModel
        isUnstableAgent = resolution.isUnstableAgent
        fallbackChain = resolution.fallbackChain
        maxPromptTokens = resolution.maxPromptTokens

        const isRunInBackgroundExplicitlyFalse = args.run_in_background === false || args.run_in_background === "false" as unknown as boolean

        log("[task] unstable agent detection", {
          category: args.category,
          actualModel,
          isUnstableAgent,
          run_in_background_value: args.run_in_background,
          run_in_background_type: typeof args.run_in_background,
          isRunInBackgroundExplicitlyFalse,
          willForceBackground: isUnstableAgent && isRunInBackgroundExplicitlyFalse,
        })

        if (isUnstableAgent && isRunInBackgroundExplicitlyFalse) {
          const systemContent = buildSystemContent({
            skillContent,
            skillContents,
            categoryPromptAppend,
            agentName: agentToUse,
            maxPromptTokens,
            model: categoryModel,
            availableCategories,
            availableSkills,
          })
          return executeUnstableAgentTask(args, ctx, options, parentContext, agentToUse, categoryModel, systemContent, actualModel)
        }
      } else {
        const resolution = await resolveSubagentExecution(args, options, parentContext.agent, categoryExamples)
        if (resolution.error) {
          return resolution.error
        }
        agentToUse = resolution.agentToUse
        categoryModel = resolution.categoryModel
        fallbackChain = resolution.fallbackChain
      }

      // Background-capability gate: reject run_in_background=true for
      // agents that only make sense to dispatch synchronously (oracle,
      // argus, code-reviewer — consultation/review agents whose entire
      // value is gating the caller's next step on their verdict).
      // Declared in src/agents/agent-capabilities.ts; unlisted agents
      // default to backgroundCapable=true.
      if (runInBackground) {
        const agentConfigKey = getAgentConfigKey(agentToUse)
        if (!isAgentBackgroundCapable(agentConfigKey)) {
          return `Agent "${agentToUse}" does not support run_in_background=true. This agent's value depends on you waiting for its verdict before proceeding. Re-dispatch with run_in_background=false, or use a different agent for parallel exploration.`
        }
      }

      const systemContent = buildSystemContent({
        skillContent,
        skillContents,
        categoryPromptAppend,
        agentName: agentToUse,
        maxPromptTokens,
        model: categoryModel,
        availableCategories,
        availableSkills,
      })

      // Teammate validation + capacity check (must happen after agentToUse
      // is resolved but before any spawn).
      const teammateRegistry = options.teammateRegistry
      const teammatesCfg = options.teammatesConfig
      const teammatesEnabled = teammatesCfg?.enabled !== false
      const wantsTeammate = args.teammate === true
      const teammateName = args.teammate_name?.trim()
      const maxConcurrent = teammatesCfg?.max_concurrent ?? 5
      const parentSessionID = parentContext.sessionID

      if (wantsTeammate) {
        if (!teammateName) {
          return `Invalid arguments: teammate=true requires teammate_name. Pick a short stable name (e.g. "researcher") you can reuse in send_message_to_teammate.`
        }
        if (!teammatesEnabled || !teammateRegistry) {
          return `Teammates feature is disabled by configuration. Set teammates.enabled=true in oh-my-openagent.jsonc or omit teammate=true.`
        }
        if (runInBackground) {
          log("[task] teammate=true ignored for background task (v1 is sync-only)", {
            agent: agentToUse,
            teammateName,
          })
        } else {
          const existing = teammateRegistry.get(parentSessionID, teammateName)
          if (!existing) {
            const currentCount = teammateRegistry.list(parentSessionID).length
            if (currentCount >= maxConcurrent) {
              const existingNames = teammateRegistry.list(parentSessionID).map((e) => e.name).join(", ")
              return `Cannot register teammate "${teammateName}": already at capacity (${currentCount}/${maxConcurrent}) for this session. Current teammates: ${existingNames}. Dismiss one with dismiss_teammate, reuse an existing name, or raise teammates.max_concurrent in config.`
            }
          }
        }
      }

      if (runInBackground) {
        if (args.run_in_worktree) {
          log("[task] run_in_worktree ignored for background task (v1 is sync-only)", {
            agent: agentToUse,
            description: args.description,
          })
        }
        return executeBackgroundTask(args, ctx, options, parentContext, agentToUse, categoryModel, systemContent, fallbackChain)
      }

      // Sync-path teammate registration: wrap onSyncSessionCreated so
      // the teammate entry is created as soon as the spawned session ID
      // is known. Original callback (if any — e.g. tmux routing) still
      // fires first.
      const syncOptions: DelegateTaskToolOptions =
        wantsTeammate && teammateName && teammateRegistry && teammatesEnabled
          ? {
              ...options,
              onSyncSessionCreated: async (event) => {
                if (options.onSyncSessionCreated) await options.onSyncSessionCreated(event)
                const res = teammateRegistry.register({
                  name: teammateName,
                  sessionID: event.sessionID,
                  agent: agentToUse,
                  parentSessionID,
                  maxConcurrent,
                })
                log("[task/teammate] registered", {
                  kind: res.kind,
                  name: teammateName,
                  sessionID: event.sessionID,
                  parentSessionID,
                })
              },
            }
          : options

      if (args.run_in_worktree) {
        const label = `${agentToUse}-${args.description}`
        const { result, worktree } = await withWorktree(syncOptions.directory, label, async (worktreePath) => {
          return executeSyncTask(
            args,
            ctx,
            { ...syncOptions, directory: worktreePath },
            parentContext,
            agentToUse,
            categoryModel,
            systemContent,
            modelInfo,
            fallbackChain,
          )
        })
        if (worktree.hasChanges) {
          const header = `\n\n[worktree isolation] Agent produced changes.\n  branch: ${worktree.branch}\n  path:   ${worktree.worktreePath}\nReview, cherry-pick, or \`git worktree remove ${worktree.worktreePath}\` to discard.\n`
          return typeof result === "string" ? `${result}${header}` : result
        }
        return result
      }

      return executeSyncTask(args, ctx, syncOptions, parentContext, agentToUse, categoryModel, systemContent, modelInfo, fallbackChain)
    },
  })
}
