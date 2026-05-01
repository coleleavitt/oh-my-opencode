import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { TeammateRegistry } from "../features/teammates"
import type { ToolContextWithMetadata } from "./delegate-task/types"
import { log } from "../shared/logger"

export interface RequestShutdownOptions {
  teammateRegistry: TeammateRegistry
}

/**
 * request_shutdown — callable BY a teammate to ask the team leader
 * (parent session) for permission to terminate. The parent can approve
 * via dismiss_teammate or reject by sending a follow-up message.
 */
export function createRequestShutdownTool(options: RequestShutdownOptions): ToolDefinition {
  return tool({
    description: `Request permission from the team leader to shut down. Use when your assigned task is complete or you cannot make further progress. The leader will either approve (you'll be dismissed) or reject with further instructions.`,
    args: {
      reason: tool.schema.string().describe("Why you want to shut down (e.g. 'task complete', 'blocked on X')."),
    },
    async execute(args: { reason: string }, toolContext) {
      const ctx = toolContext as ToolContextWithMetadata
      const reason = args.reason?.trim()
      if (!reason) return `Invalid arguments: reason is required.`

      const match = options.teammateRegistry.findBySessionID(ctx.sessionID)
      if (!match) {
        return `Cannot request shutdown: this session is not a registered teammate.`
      }

      const entry = options.teammateRegistry.requestShutdown(match.parentSessionID, match.entry.name, reason)
      if (!entry) return `Failed to request shutdown — teammate not found.`

      log("[request-shutdown] requested", {
        name: entry.name,
        reason,
        parentSessionID: match.parentSessionID,
      })
      return `Shutdown request sent to team leader. Reason: "${reason}". Waiting for approval.`
    },
  })
}
