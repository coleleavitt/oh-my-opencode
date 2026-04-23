import { describe, expect, it, mock } from "bun:test"
import type { SkillMcpManager } from "../skill-mcp-manager"
import { createMcpHookInvoker } from "./invoker"
import type { McpServersMap } from "./types"

const TEST_MCP_SERVERS: McpServersMap = {
  "test-mcp": { type: "http", url: "http://localhost:3000" },
}

function makeMockManager(
  callToolImpl: SkillMcpManager["callTool"] = async () => ({ content: "mocked" }),
): SkillMcpManager {
  return { callTool: callToolImpl } as unknown as SkillMcpManager
}

describe("createMcpHookInvoker", () => {
  describe("#given unknown MCP name", () => {
    it("#then returns unknown_mcp status", async () => {
      // given
      const invoke = createMcpHookInvoker({
        skillMcpManager: makeMockManager(),
        mcpServers: TEST_MCP_SERVERS,
      })

      // when
      const result = await invoke({ mcp: "nonexistent", tool: "some-tool" })

      // then
      expect(result.status).toBe("unknown_mcp")
      expect(result).toHaveProperty("error")
      expect(result.error).toContain("nonexistent")
    })
  })

  describe("#given known MCP and callTool succeeds", () => {
    it("#then returns ok status with output", async () => {
      // given
      const mockResult = { content: [{ type: "text", text: "hello" }] }
      const invoke = createMcpHookInvoker({
        skillMcpManager: makeMockManager(async () => mockResult),
        mcpServers: TEST_MCP_SERVERS,
      })

      // when
      const result = await invoke({ mcp: "test-mcp", tool: "greet" })

      // then
      expect(result.status).toBe("ok")
      expect(result).toHaveProperty("output", mockResult)
    })
  })

  describe("#given known MCP and callTool throws", () => {
    it("#then returns error status", async () => {
      // given
      const invoke = createMcpHookInvoker({
        skillMcpManager: makeMockManager(async () => {
          throw new Error("connection refused")
        }),
        mcpServers: TEST_MCP_SERVERS,
      })

      // when
      const result = await invoke({ mcp: "test-mcp", tool: "fail-tool" })

      // then
      expect(result.status).toBe("error")
      expect(result.error).toContain("connection refused")
    })
  })

  describe("#given slow callTool exceeding timeoutMs", () => {
    it("#then returns timeout status", async () => {
      // given
      const invoke = createMcpHookInvoker({
        skillMcpManager: makeMockManager(
          () => new Promise((resolve) => setTimeout(resolve, 500)),
        ),
        mcpServers: TEST_MCP_SERVERS,
      })

      // when
      const result = await invoke({
        mcp: "test-mcp",
        tool: "slow-tool",
        timeoutMs: 50,
      })

      // then
      expect(result.status).toBe("timeout")
      expect(result.error).toContain("timed out")
      expect(result.error).toContain("50ms")
    })
  })

  describe("#given no timeoutMs provided", () => {
    it("#then uses default 30_000ms timeout", async () => {
      // given
      const callToolFn = mock(async () => ({ content: "fast" }))
      const invoke = createMcpHookInvoker({
        skillMcpManager: makeMockManager(callToolFn as SkillMcpManager["callTool"]),
        mcpServers: TEST_MCP_SERVERS,
      })

      // when
      const result = await invoke({ mcp: "test-mcp", tool: "fast-tool" })

      // then
      expect(result.status).toBe("ok")
      expect(callToolFn).toHaveBeenCalledTimes(1)
    })
  })

  describe("#given arguments passed through", () => {
    it("#then callTool receives them correctly", async () => {
      // given
      const callToolFn = mock(async () => ({ content: "done" }))
      const invoke = createMcpHookInvoker({
        skillMcpManager: makeMockManager(callToolFn as SkillMcpManager["callTool"]),
        mcpServers: TEST_MCP_SERVERS,
        sessionID: "test-session",
      })
      const toolArgs = { query: "hello", limit: 10 }

      // when
      await invoke({ mcp: "test-mcp", tool: "search", arguments: toolArgs })

      // then
      expect(callToolFn).toHaveBeenCalledWith(
        { sessionID: "test-session", serverName: "test-mcp", skillName: "mcp-hook-invoker" },
        { config: TEST_MCP_SERVERS["test-mcp"], skillName: "mcp-hook-invoker" },
        "search",
        toolArgs,
      )
    })
  })
})
