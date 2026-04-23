import type { OhMyOpenCodeConfig } from "../../config"
import { log } from "../../shared"

const HOOK_TAG = "[permission-denied]"

export function createPermissionDeniedHook(pluginConfig: OhMyOpenCodeConfig) {
  const config = pluginConfig.permission_automation
  if (!config?.enabled) return {}

  log(`${HOOK_TAG} Permission denied tracking enabled`)

  return {
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: unknown } | undefined,
    ): Promise<void> => {
      if (!config.log_decisions) return
      const meta = output?.metadata as Record<string, unknown> | undefined
      if (meta?.permission_denied) {
        log(`${HOOK_TAG} Tool permission denied`, {
          tool: input.tool,
          sessionID: input.sessionID,
        })
      }
    },
  }
}
