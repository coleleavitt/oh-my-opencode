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

      const parentSessionID = ctx.sessionID
      const entry = options.teammateRegistry.get(parentSessionID, name)
      if (!entry) {
        const known = options.teammateRegistry.list(parentSessionID).map((e) => `"${e.name}" (${e.agent})`).join(", ")
        return `Unknown teammate "${name}" for this session. ${known ? `Known teammates: ${known}.` : "No teammates registered yet."} Spawn one with task(teammate=true, teammate_name="${name}", subagent_type=..., prompt=..., run_in_background=false).`
      }

      options.teammateRegistry.touch(parentSessionID, name, "running")
      options.teammateRegistry.recordMessage(parentSessionID, name, "parent", args.prompt)

      const continuationArgs: DelegateTaskArgs = {
        description: `continue → ${name}`,
        prompt: args.prompt,
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
