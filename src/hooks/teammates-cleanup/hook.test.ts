/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test"
import { createTeammatesCleanupHook } from "./hook"
import { createTeammateRegistry } from "../../features/teammates"

const mkEvent = (type: string, info: Record<string, unknown> = {}) => ({
  event: { type, properties: { info } },
})

describe("teammates-cleanup hook", () => {
  it("clears a parent's teammates on session.deleted", async () => {
    const registry = createTeammateRegistry()
    registry.register({ name: "alpha", sessionID: "sA", agent: "explore", parentSessionID: "parent-A", maxConcurrent: 5 })
    registry.register({ name: "beta", sessionID: "sB", agent: "librarian", parentSessionID: "parent-A", maxConcurrent: 5 })
    const hook = createTeammatesCleanupHook(registry)

    await hook.event(mkEvent("session.deleted", { id: "parent-A" }))

    expect(registry.list("parent-A")).toEqual([])
  })

  it("does NOT clear other parents' teammates", async () => {
    const registry = createTeammateRegistry()
    registry.register({ name: "mine", sessionID: "sA", agent: "explore", parentSessionID: "parent-A", maxConcurrent: 5 })
    registry.register({ name: "theirs", sessionID: "sB", agent: "explore", parentSessionID: "parent-B", maxConcurrent: 5 })
    const hook = createTeammatesCleanupHook(registry)

    await hook.event(mkEvent("session.deleted", { id: "parent-A" }))

    expect(registry.list("parent-A")).toEqual([])
    expect(registry.list("parent-B")).toHaveLength(1)
  })

  it("is a no-op for unrelated event types", async () => {
    const registry = createTeammateRegistry()
    registry.register({ name: "alpha", sessionID: "sA", agent: "explore", parentSessionID: "parent-A", maxConcurrent: 5 })
    const hook = createTeammatesCleanupHook(registry)

    await hook.event(mkEvent("message.updated", { id: "parent-A" }))
    await hook.event(mkEvent("session.compacted", { id: "parent-A" }))

    expect(registry.list("parent-A")).toHaveLength(1)
  })

  it("is a no-op when registry is undefined (feature disabled)", async () => {
    const hook = createTeammatesCleanupHook(undefined)
    // should not throw
    await hook.event(mkEvent("session.deleted", { id: "parent-A" }))
  })

  it("is a no-op when the event payload is missing info.id", async () => {
    const registry = createTeammateRegistry()
    registry.register({ name: "alpha", sessionID: "sA", agent: "explore", parentSessionID: "parent-A", maxConcurrent: 5 })
    const hook = createTeammatesCleanupHook(registry)

    await hook.event({ event: { type: "session.deleted", properties: {} } })

    expect(registry.list("parent-A")).toHaveLength(1)
  })

  it("clears nothing silently when the parent has no teammates", async () => {
    const registry = createTeammateRegistry()
    const hook = createTeammatesCleanupHook(registry)
    await hook.event(mkEvent("session.deleted", { id: "parent-nobody" }))
    // no throw, no state change
    expect(registry.snapshot()).toEqual([])
  })
})
