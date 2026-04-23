import type { OhMyOpenCodeConfig } from "../../config"
import { log } from "../../shared"
import { matchRule } from "../../features/permission-automation"

const HOOK_TAG = "[permission-request]"

export function createPermissionRequestHook(pluginConfig: OhMyOpenCodeConfig) {
  const config = pluginConfig.permission_automation
  if (!config?.enabled || config.rules.length === 0) return {}

  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ): Promise<void> => {
      const command = typeof output.args.command === "string" ? output.args.command : undefined
      const match = matchRule({ tool: input.tool.toLowerCase(), command }, config.rules)
      if (!match.matched) return

      if (config.log_decisions) {
        log(`${HOOK_TAG} Rule matched`, {
          tool: input.tool,
          command: command?.slice(0, 80),
          action: match.action,
          pattern: match.rule.tool_pattern,
        })
      }

      if (match.action === "deny") {
        log(`${HOOK_TAG} DENIED`, {
          tool: input.tool,
          command: command?.slice(0, 80),
          rule: match.rule.tool_pattern,
          commandPattern: match.rule.command_pattern,
        })
        throw new Error(
          `Permission denied by rule: ${match.rule.tool_pattern}${match.rule.command_pattern ? ` (${match.rule.command_pattern})` : ""}`,
        )
      }
    },
  }
}
