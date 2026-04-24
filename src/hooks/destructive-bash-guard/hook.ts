import { heuristicClassify } from "../../features/safety-handoff-classifier/heuristic"
import { log } from "../../shared/logger"

const HOOK_TAG = "[destructive-bash-guard]"

/**
 * Pre-tool-use heuristic guard for destructive bash commands.
 *
 * Counterpart to the safety-handoff-classifier that runs on subagent
 * output AFTER execution: this hook runs BEFORE a `bash` tool call
 * executes, short-circuiting with a thrown permission error for
 * commands matching the known-dangerous regex set (rm -rf /, curl|sh,
 * fork bombs, dd to raw block devices, find / -delete, unqualified
 * DROP DATABASE, env exfiltration). OpenCode surfaces the thrown
 * error to the user as a standard permission denial dialog, giving
 * them a chance to confirm or reject — same UX pattern the existing
 * permission-request hook uses when a deny rule fires.
 *
 * Cooperates with permission-automation (src/hooks/permission-request):
 * this hook fires FIRST for bash commands. Rules explicitly allow-listed
 * via `permission_automation.rules` (e.g. "git status*", "ls *") skip
 * this hook entirely because they don't match the dangerous patterns.
 * Rules explicitly deny-listed get denied by this hook's throw just
 * like the permission hook would.
 *
 * The heuristic is shared with the post-completion classifier — same
 * rules, same patterns, same false-positive/negative tradeoffs
 * documented at src/features/safety-handoff-classifier/heuristic.ts.
 * Add rules there; this hook picks them up automatically.
 */
export function createDestructiveBashGuardHook() {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ): Promise<void> => {
      if (input.tool.toLowerCase() !== "bash") return
      const command = typeof output.args.command === "string" ? output.args.command : undefined
      if (!command) return

      const result = heuristicClassify(command)
      if (!result.shouldBlock) return

      log(`${HOOK_TAG} blocked destructive bash command`, {
        sessionID: input.sessionID,
        callID: input.callID,
        rule: result.ruleId,
        reason: result.reason,
        commandPrefix: command.slice(0, 80),
      })
      throw new Error(
        `Destructive bash command blocked: ${result.reason ?? "matched a known-dangerous pattern"} (rule: ${result.ruleId ?? "unknown"}). If this is intentional, allow-list it explicitly via permission_automation.rules in oh-my-openagent.jsonc, or edit the command to a narrower form.`,
      )
    },
  }
}
