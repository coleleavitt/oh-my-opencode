import { z } from "zod"

export const PermissionActionSchema = z.enum(["allow", "deny", "ask"])

export const PermissionRuleSchema = z.object({
  tool_pattern: z.string().min(1).describe("Glob pattern matching tool name, e.g., 'bash', 'edit', 'write', or 'grep_app_*'"),
  command_pattern: z.string().optional().describe("Optional sub-pattern for bash commands, e.g., 'npm *', 'git status*'"),
  action: PermissionActionSchema,
})
export type PermissionRule = z.infer<typeof PermissionRuleSchema>

export const PermissionAutomationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  rules: z.array(PermissionRuleSchema).default([]),
  log_decisions: z.boolean().default(true),
})
export type PermissionAutomationConfig = z.infer<typeof PermissionAutomationConfigSchema>
