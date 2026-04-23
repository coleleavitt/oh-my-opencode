import type { ClaudeCodeMcpServer } from "../claude-code-mcp-loader/types"

export interface McpToolInvocationParams {
  mcp: string
  tool: string
  arguments?: Record<string, unknown>
  timeoutMs?: number
}

export type McpToolInvocationResult =
  | { status: "ok"; output: unknown }
  | { status: "error"; error: string }
  | { status: "timeout"; error: string }
  | { status: "unknown_mcp"; error: string }

export type McpServersMap = Record<string, ClaudeCodeMcpServer>
