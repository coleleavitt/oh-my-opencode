import type { CommandDefinition } from "../claude-code-command-loader"

export type BuiltinCommandName = "init-deep" | "ralph-loop" | "cancel-ralph" | "ulw-loop" | "refactor" | "start-work" | "stop-continuation" | "handoff" | "review" | "review-loop" | "remove-ai-slops" | "security-review" | "thinking-off" | "thinking-on" | "effort-xhigh"

export interface BuiltinCommandConfig {
  disabled_commands?: BuiltinCommandName[]
}

export type BuiltinCommands = Record<string, CommandDefinition>
