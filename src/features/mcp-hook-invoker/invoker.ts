import type { SkillMcpManager } from "../skill-mcp-manager"
import { log } from "../../shared/logger"
import type {
  McpServersMap,
  McpToolInvocationParams,
  McpToolInvocationResult,
} from "./types"

const HOOK_TAG = "[mcp-hook-invoker]"
const DEFAULT_TIMEOUT_MS = 30_000
const SKILL_NAME = "mcp-hook-invoker"

export function createMcpHookInvoker(params: {
  skillMcpManager: SkillMcpManager
  mcpServers: McpServersMap
  sessionID?: string
}) {
  const { skillMcpManager, mcpServers, sessionID = "mcp-hook-invoker" } = params

  return async function invokeMcpTool(
    input: McpToolInvocationParams,
  ): Promise<McpToolInvocationResult> {
    const { mcp, tool, arguments: args = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = input
    const config = mcpServers[mcp]
    if (!config) {
      log(`${HOOK_TAG} Unknown MCP`, { mcp })
      return {
        status: "unknown_mcp",
        error: `MCP server "${mcp}" not found in mcpServers map`,
      }
    }

    const clientInfo = { sessionID, serverName: mcp, skillName: SKILL_NAME }
    const serverContext = { config, skillName: SKILL_NAME }

    let settled = false
    let timerId: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<McpToolInvocationResult>((resolve) => {
      timerId = setTimeout(() => {
        if (settled) return
        settled = true
        resolve({
          status: "timeout",
          error: `MCP tool ${mcp}/${tool} timed out after ${timeoutMs}ms`,
        })
      }, timeoutMs)
    })

    const invocation = (async (): Promise<McpToolInvocationResult> => {
      try {
        const result = await skillMcpManager.callTool(
          clientInfo,
          serverContext,
          tool,
          args,
        )
        if (settled) return { status: "ok", output: result }
        settled = true
        if (timerId !== undefined) clearTimeout(timerId)
        return { status: "ok", output: result }
      } catch (err) {
        if (settled) return { status: "error", error: String(err) }
        settled = true
        if (timerId !== undefined) clearTimeout(timerId)
        return { status: "error", error: String(err) }
      }
    })()

    return Promise.race([invocation, timeout])
  }
}
