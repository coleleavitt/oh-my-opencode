/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test"
import {
  AGENT_CAPABILITIES,
  getAgentCapabilities,
  getAgentRequiredMcpServers,
  isAgentBackgroundCapable,
} from "./agent-capabilities"

describe("AGENT_CAPABILITIES registry", () => {
  it("marks oracle and argus as NOT backgroundCapable (consultation/review contract)", () => {
    expect(isAgentBackgroundCapable("oracle")).toBe(false)
    expect(isAgentBackgroundCapable("argus")).toBe(false)
    expect(isAgentBackgroundCapable("code-reviewer")).toBe(false)
  })

  it("defaults to backgroundCapable=true for agents without an entry", () => {
    expect(isAgentBackgroundCapable("sisyphus")).toBe(true)
    expect(isAgentBackgroundCapable("explore")).toBe(true)
    expect(isAgentBackgroundCapable("librarian")).toBe(true)
    expect(isAgentBackgroundCapable("hephaestus")).toBe(true)
  })

  it("accepts any casing for the agent key", () => {
    expect(isAgentBackgroundCapable("ORACLE")).toBe(false)
    expect(isAgentBackgroundCapable("Oracle")).toBe(false)
    expect(isAgentBackgroundCapable("  oracle  ".trim())).toBe(false)
  })

  it("returns the required MCP server list for agents that declare one", () => {
    expect(getAgentRequiredMcpServers("multimodal-looker")).toEqual(["playwright"])
  })

  it("returns an empty array for agents without MCP requirements", () => {
    expect(getAgentRequiredMcpServers("sisyphus")).toEqual([])
    expect(getAgentRequiredMcpServers("oracle")).toEqual([])
    expect(getAgentRequiredMcpServers("unknown-agent")).toEqual([])
  })

  it("getAgentCapabilities returns empty object for unknown agents (no undefined)", () => {
    const caps = getAgentCapabilities("this-agent-does-not-exist")
    expect(caps).toEqual({})
  })

  it("every AGENT_CAPABILITIES key is lowercase", () => {
    for (const key of Object.keys(AGENT_CAPABILITIES)) {
      expect(key).toBe(key.toLowerCase())
    }
  })
})
