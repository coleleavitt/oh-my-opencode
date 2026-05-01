import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { TeammateRegistry } from "../features/teammates"
import type { ToolContextWithMetadata } from "./delegate-task/types"
import { log } from "../shared/logger"

export interface TeammateTaskUpdateOptions {
  teammateRegistry: TeammateRegistry
}

/**
 * task_update (teammate variant) — callable BY a teammate to push
 * status updates visible to the parent in list_teammates output.
 * Separate from send_message_to_teammate (which is conversational).
 */
export function createTeammateTaskUpdateTool(options: TeammateTaskUpdateOptions): ToolDefinition {
  return tool({
    description: `Push a task status update visible to the team leader. Use to report progress, mark completion, or signal blockers — without sending a conversational message.

The leader sees these updates in list_teammates output.`,
    args: {
      status: tool.schema.enum(["in_progress", "completed", "blocked", "needs_review"])
        .describe("Current task lifecycle state."),
      summary: tool.schema.string()
        .describe("One-line headline of what happened (≤200 chars)."),
      progress: tool.schema.number().optional()
        .describe("Completion percentage (0-100). Omit if not applicable."),
    },
    async execute(args: { status: "in_progress" | "completed" | "blocked" | "needs_review"; summary: string; progress?: number }, toolContext) {
      const ctx = toolContext as ToolContextWithMetadata
      const summary = args.summary?.trim()
      if (!summary) return `Invalid arguments: summary is required.`
      if (!args.status) return `Invalid arguments: status is required.`

      const match = options.teammateRegistry.findBySessionID(ctx.sessionID)
      if (!match) {
        return `Cannot update task: this session is not a registered teammate.`
      }

      const entry = options.teammateRegistry.updateTask(match.parentSessionID, match.entry.name, {
        status: args.status,
        summary,
        progress: args.progress,
      })
      if (!entry) return `Failed to update task — teammate not found.`

      log(`[task-update] ${entry.name}: ${args.status} — ${summary}`)
      return `Task updated: ${args.status}${args.progress !== undefined ? ` (${entry.taskProgress}%)` : ""} — ${entry.taskSummary}`
    },
  })
}
