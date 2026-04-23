import type { PermissionRule } from "../../config/schema/permission-automation"

export const DEFAULT_ALLOW_RULES: readonly PermissionRule[] = [
  { tool_pattern: "bash", command_pattern: "git status*", action: "allow" },
  { tool_pattern: "bash", command_pattern: "git diff*", action: "allow" },
  { tool_pattern: "bash", command_pattern: "git log*", action: "allow" },
  { tool_pattern: "bash", command_pattern: "git branch*", action: "allow" },
  { tool_pattern: "bash", command_pattern: "ls", action: "allow" },
  { tool_pattern: "bash", command_pattern: "ls *", action: "allow" },
  { tool_pattern: "bash", command_pattern: "pwd*", action: "allow" },
] as const
