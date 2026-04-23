import type { OhMyOpenCodeConfig } from "../../config"
import type { PluginInput } from "@opencode-ai/plugin"
import { clearCwdState, recordCwdChange } from "../../features/cwd-tracker"
import { log } from "../../shared/logger"

const HOOK_TAG = "[cwd-changed]"

export function createCwdChangedHook(ctx: PluginInput, pluginConfig: OhMyOpenCodeConfig) {
  const config = pluginConfig.cwd_changed
  if (!config?.enabled) return {}

  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ): Promise<void> => {
      if (input.tool.toLowerCase() !== "bash") return

      const command = output.args.command
      if (typeof command !== "string") return

      const result = recordCwdChange(input.sessionID, command, ctx.directory)
      if (result.changed) {
        log(`${HOOK_TAG} cwd changed`, {
          sessionID: input.sessionID,
          oldCwd: result.oldCwd,
          newCwd: result.newCwd,
        })
      }
    },
    event: async ({ event }: { event: { type: string; properties?: unknown } }) => {
      if (event.type !== "session.deleted") return
      const props = event.properties as { info?: { id?: string } } | undefined
      const sessionID = props?.info?.id
      if (sessionID) clearCwdState(sessionID)
    },
  }
}
