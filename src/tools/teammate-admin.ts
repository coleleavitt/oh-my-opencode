import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { TeammateRegistry } from "../features/teammates"
import type { TeammatesConfig } from "../config/schema"
import type { OpencodeClient, ToolContextWithMetadata } from "./delegate-task/types"
import { log } from "../shared/logger"

export interface TeammateAdminOptions {
  client: OpencodeClient
  teammateRegistry?: TeammateRegistry
  teammatesConfig?: TeammatesConfig
}

/**
 * list_teammates — list all teammates registered for the current parent
 * session. Returns a compact markdown table; empty state is an explicit
 * single-line "no teammates" rather than an empty string so the LLM has
 * something to act on.
 */
export function createListTeammates(options: TeammateAdminOptions): ToolDefinition {
  return tool({
    description: `List all teammates currently registered for this session.

Each row: name, agent type, status (pending | running | idle | error), and age since registration.

Use when you're unsure which teammates are available, or before calling send_message_to_teammate with a name you're not sure about. Returns "No teammates registered for this session" when empty.`,
    args: {},
    async execute(_args, toolContext) {
      const ctx = toolContext as ToolContextWithMetadata
      const teammatesEnabled = options.teammatesConfig?.enabled !== false
      if (!teammatesEnabled || !options.teammateRegistry) {
        return `Teammates feature is disabled by configuration.`
      }
      const entries = options.teammateRegistry.list(ctx.sessionID)
      if (entries.length === 0) {
        return `No teammates registered for this session. Spawn one with task(teammate=true, teammate_name="...", subagent_type=..., prompt=..., run_in_background=false).`
      }
      const now = Date.now()
      const lines = [
        `| name | agent | status | age | last message |`,
        `|------|-------|--------|-----|--------------|`,
      ]
      for (const e of entries) {
        const ageSec = Math.round((now - e.createdAt) / 1000)
        const age = ageSec < 60 ? `${ageSec}s` : ageSec < 3600 ? `${Math.round(ageSec / 60)}m` : `${Math.round(ageSec / 3600)}h`
        const dm = e.lastMessage && e.lastMessageFrom
          ? `from ${e.lastMessageFrom}: ${e.lastMessage}`
          : ""
        lines.push(`| ${e.name} | ${e.agent} | ${e.status} | ${age} | ${dm} |`)
      }
      return lines.join("\n")
    },
  })
}

/**
 * dismiss_teammate — remove a teammate from the registry and abort its
 * underlying session. The abort is best-effort (we don't want dismiss to
 * fail because the session was already terminated); success is measured
 * by the registry removal, which is authoritative.
 */
export function createDismissTeammate(options: TeammateAdminOptions): ToolDefinition {
  return tool({
    description: `Dismiss a previously-registered teammate: abort its session and remove it from this session's registry. Frees a slot toward the teammates.max_concurrent cap. Safe to call on an unknown name (returns a clear "no such teammate" message).`,
    args: {
      name: tool.schema.string().describe("The teammate's stable name to dismiss."),
    },
    async execute(args: { name: string }, toolContext) {
      const ctx = toolContext as ToolContextWithMetadata
      const teammatesEnabled = options.teammatesConfig?.enabled !== false
      if (!teammatesEnabled || !options.teammateRegistry) {
        return `Teammates feature is disabled by configuration.`
      }
      const name = args.name?.trim()
      if (!name) return `Invalid arguments: name is required.`

      const parentSessionID = ctx.sessionID
      const entry = options.teammateRegistry.get(parentSessionID, name)
      if (!entry) {
        return `No teammate named "${name}" is registered for this session.`
      }

      // Abort first, remove second — if abort throws, we still want the
      // registry cleaned up (the session is presumably unreachable).
      try {
        await options.client.session.abort({ path: { id: entry.sessionID } })
      } catch (err) {
        log("[dismiss_teammate] abort failed (proceeding with removal)", {
          name,
          sessionID: entry.sessionID,
          error: String(err),
        })
      }

      options.teammateRegistry.dismiss(parentSessionID, name)
      log("[dismiss_teammate] dismissed", { name, sessionID: entry.sessionID, parentSessionID })
      return `Dismissed teammate "${name}" (session ${entry.sessionID.slice(0, 8)}). Slot freed.`
    },
  })
}
