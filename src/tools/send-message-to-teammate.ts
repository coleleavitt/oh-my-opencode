import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { BackgroundManager } from "../features/background-agent"
import type { TeammateRegistry } from "../features/teammates"
import type { TeammatesConfig, SisyphusAgentConfig } from "../config/schema"
import type {
  DelegateTaskArgs,
  OpencodeClient,
  ToolContextWithMetadata,
} from "./delegate-task/types"
import { executeSyncContinuation, executeBackgroundContinuation } from "./delegate-task/executor"
import { resolveParentContext } from "./delegate-task/parent-context-resolver"
import { ensureTeamMemoryDir } from "../features/auto-memory"
import { log } from "../shared/logger"

export interface SendMessageToTeammateOptions {
  client: OpencodeClient
  manager: BackgroundManager
  directory: string
  teammateRegistry?: TeammateRegistry
  teammatesConfig?: TeammatesConfig
  syncPollTimeoutMs?: number
  sisyphusAgentConfig?: SisyphusAgentConfig
}

/**
 * Address a previously-spawned teammate by name and send it a new
 * prompt, continuing its session with full context preserved.
 *
 * Spawn a teammate with `task(teammate=true, teammate_name="name", ...)`,
 * then talk to it again with `send_message_to_teammate(name="name",
 * prompt="...")`. The teammate session stays alive across turns — saving
 * tokens vs re-delegating from scratch and preserving the agent's
 * accumulated understanding.
 *
 * See src/features/teammates/DESIGN.md for the full design.
 */
export function createSendMessageToTeammate(options: SendMessageToTeammateOptions): ToolDefinition {
  const description = `Send a new prompt to a previously-registered teammate (named subagent) to continue its session across turns.

**Workflow:**
1. Spawn: \`task(teammate=true, teammate_name="researcher", subagent_type="explore", ...)\`
2. Message: \`send_message_to_teammate(name="researcher", prompt="now look at ...", run_in_background=false)\`
3. Dismiss when done: \`dismiss_teammate(name="researcher")\`

**When to use:**
- Multi-turn back-and-forth with the SAME specialist (reviewer, researcher, domain expert)
- Follow-up questions on a prior task without rebuilding context

**When NOT to use:**
- First dispatch → use \`task\` with \`teammate: true\` to spawn AND send the first message
- One-shot tasks with no follow-up → plain \`task\` is fine

Fails with a clear error if the name isn't registered for this session (use \`list_teammates\` to see what's available).`

  return tool({
    description,
    args: {
      name: tool.schema.string().describe("The teammate's stable name, from a prior task(teammate=true, teammate_name=...) call."),
      prompt: tool.schema.string().describe("Message to send. English only."),
      run_in_background: tool.schema.boolean().describe("REQUIRED. true=async (returns task_id), false=sync (waits for response)."),
    },
    async execute(args: { name: string; prompt: string; run_in_background: boolean }, toolContext) {
      const ctx = toolContext as ToolContextWithMetadata

      const teammatesEnabled = options.teammatesConfig?.enabled !== false
      if (!teammatesEnabled || !options.teammateRegistry) {
        return `Teammates feature is disabled by configuration. Set teammates.enabled=true in oh-my-openagent.jsonc or use plain \`task\` instead.`
      }

      const name = args.name?.trim()
      if (!name) {
        return `Invalid arguments: name is required.`
      }

      // Resolve the target teammate. Two paths:
      // 1. Parent → teammate (existing): registry.get(currentSessionID, name)
      // 2. Peer → peer (new): current session IS a teammate, look up via shared parent
      let parentSessionID = ctx.sessionID
      let entry = options.teammateRegistry.get(parentSessionID, name)
      let isPeerDM = false
      let senderName = "parent"

      if (!entry) {
        const selfLookup = options.teammateRegistry.findBySessionID(ctx.sessionID)
        if (selfLookup) {
          parentSessionID = selfLookup.parentSessionID
          senderName = selfLookup.entry.name

          if (senderName === name) {
            return `Cannot send a message to yourself ("${name}").`
          }

          entry = options.teammateRegistry.get(parentSessionID, name)
          isPeerDM = !!entry
        }
      }

      if (!entry) {
        const known = options.teammateRegistry.list(parentSessionID).map((e) => `"${e.name}" (${e.agent})`).join(", ")
        return `Unknown teammate "${name}" for this session. ${known ? `Known teammates: ${known}.` : "No teammates registered yet."} Spawn one with task(teammate=true, teammate_name="${name}", subagent_type=..., prompt=..., run_in_background=false).`
      }

      options.teammateRegistry.touch(parentSessionID, name, "running")

      // Ensure team memory dir exists and is stored on the entry
      if (!entry.teamMemoryDir) {
        try {
          entry.teamMemoryDir = await ensureTeamMemoryDir(options.directory)
        } catch {
          // Non-fatal — team memory is optional
        }
      }

      const messagePrefix = isPeerDM ? `[from ${senderName}] ` : ""
      const effectivePrompt = `${messagePrefix}${args.prompt}`

      options.teammateRegistry.recordMessage(parentSessionID, name, senderName, args.prompt)

      // Implicit shutdown rejection: sending a message to a teammate
      // that's awaiting approval auto-clears the flag (leader chose to
      // continue the conversation instead of dismissing).
      if (entry.awaitingLeaderApproval && !isPeerDM) {
        options.teammateRegistry.rejectShutdown(parentSessionID, name)
        log("[send_message_to_teammate] implicitly rejected shutdown request", { name })
      }

      if (isPeerDM) {
        log("[send-message] peer DM: " + senderName + " → " + name)
      }

      const continuationArgs: DelegateTaskArgs = {
        description: `continue → ${name}`,
        prompt: effectivePrompt,
        run_in_background: args.run_in_background === true,
        task_id: entry.sessionID,
        load_skills: [],
      }

      await ctx.metadata?.({ title: continuationArgs.description })

      const executorCtx = {
        manager: options.manager,
        client: options.client,
        directory: options.directory,
        syncPollTimeoutMs: options.syncPollTimeoutMs,
        sisyphusAgentConfig: options.sisyphusAgentConfig,
      }

      try {
        let result: string
        if (continuationArgs.run_in_background) {
          const parentContext = await resolveParentContext(ctx, options.client)
          result = await executeBackgroundContinuation(continuationArgs, ctx, executorCtx, parentContext)
        } else {
          const parentContext = await resolveParentContext(ctx, options.client)
          result = await executeSyncContinuation(continuationArgs, ctx, executorCtx, parentContext)
        }
        options.teammateRegistry.touch(parentSessionID, name, "idle")
        log("[send_message_to_teammate] completed", {
          name,
          sessionID: entry.sessionID,
          background: continuationArgs.run_in_background,
        })
        return result
      } catch (err) {
        options.teammateRegistry.touch(parentSessionID, name, "error")
        log("[send_message_to_teammate] error", {
          name,
          sessionID: entry.sessionID,
          error: String(err),
        })
        throw err
      }
    },
  })
}
