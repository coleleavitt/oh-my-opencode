import { describe, it, expect } from "bun:test"
import { classifyOverflow, shouldEmitToast } from "./smart-overflow-toast"

describe("classifyOverflow", () => {
  it("classifies 200K overflow correctly", () => {
    const r = classifyOverflow({ currentTokens: 211577, maxTokens: 200000 })
    expect(r.kind).toBe("200k-overflow")
    expect(r.message).toContain("200K-capable account")
  })

  it("classifies 1M overflow correctly", () => {
    const r = classifyOverflow({ currentTokens: 1_100_000, maxTokens: 1_000_000 })
    expect(r.kind).toBe("1m-overflow")
    expect(r.message).toContain("Genuine 1M")
  })

  it("classifies sub-500K as 200k-overflow", () => {
    const r = classifyOverflow({ currentTokens: 100, maxTokens: 450_000 })
    expect(r.kind).toBe("200k-overflow")
  })
})

describe("shouldEmitToast dedup", () => {
  it("emits first toast immediately", () => {
    const state = new Map<string, number>()
    expect(shouldEmitToast(state, "anthropic", "claude-opus-4-7")).toBe(true)
  })

  it("suppresses duplicate within 5 min", () => {
    const state = new Map<string, number>()
    shouldEmitToast(state, "anthropic", "claude-opus-4-7")
    expect(shouldEmitToast(state, "anthropic", "claude-opus-4-7")).toBe(false)
  })

  it("emits again after 5 min", () => {
    const state = new Map<string, number>()
    shouldEmitToast(state, "anthropic", "claude-opus-4-7")
    state.set("anthropic:claude-opus-4-7", Date.now() - 6 * 60 * 1000)
    expect(shouldEmitToast(state, "anthropic", "claude-opus-4-7")).toBe(true)
  })
})
