import picomatch from "picomatch"
import type { PermissionRule } from "../../config/schema/permission-automation"

export interface ToolInvocation {
  tool: string
  command?: string
}

export type MatchResult = {
  matched: true
  action: "allow" | "deny" | "ask"
  rule: PermissionRule
} | {
  matched: false
}

export function matchRule(
  invocation: ToolInvocation,
  rules: readonly PermissionRule[],
): MatchResult {
  for (const rule of rules) {
    if (!picomatch.isMatch(invocation.tool, rule.tool_pattern)) continue
    if (rule.command_pattern) {
      if (!invocation.command) continue
      if (!picomatch.isMatch(invocation.command, rule.command_pattern)) continue
    }
    return { matched: true, action: rule.action, rule }
  }
  return { matched: false }
}
