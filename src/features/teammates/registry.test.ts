/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test"
import { createTeammateRegistry } from "./registry"

const DEFAULT_INPUT = {
  name: "researcher",
  sessionID: "sess-1",
  agent: "explore",
  parentSessionID: "parent-A",
  maxConcurrent: 5,
}

describe("createTeammateRegistry", () => {
  describe("register", () => {
    it("registers a fresh teammate with status=pending", () => {
      const r = createTeammateRegistry()
      const result = r.register(DEFAULT_INPUT)
      expect(result.kind).toBe("registered")
      if (result.kind !== "registered") throw new Error("narrow")
      expect(result.entry.name).toBe("researcher")
      expect(result.entry.status).toBe("pending")
      expect(result.entry.sessionID).toBe("sess-1")
      expect(result.entry.parentSessionID).toBe("parent-A")
      expect(result.entry.createdAt).toBeGreaterThan(0)
      expect(result.entry.lastActivityAt).toBe(result.entry.createdAt)
    })

    it("reuses entry on (parent, name) collision and rebinds sessionID + agent", () => {
      const r = createTeammateRegistry()
      r.register(DEFAULT_INPUT)
      const reused = r.register({ ...DEFAULT_INPUT, sessionID: "sess-2", agent: "librarian" })
      expect(reused.kind).toBe("reused")
      if (reused.kind !== "reused") throw new Error("narrow")
      expect(reused.entry.sessionID).toBe("sess-2")
      expect(reused.entry.agent).toBe("librarian")
      expect(reused.entry.status).toBe("pending")
      // still the same slot — list should have just one
      expect(r.list("parent-A")).toHaveLength(1)
    })

    it("allows same name across different parent sessions (per-parent scope)", () => {
      const r = createTeammateRegistry()
      r.register(DEFAULT_INPUT)
      const other = r.register({ ...DEFAULT_INPUT, parentSessionID: "parent-B", sessionID: "sess-9" })
      expect(other.kind).toBe("registered")
      expect(r.list("parent-A")).toHaveLength(1)
      expect(r.list("parent-B")).toHaveLength(1)
    })

    it("returns capacity_exceeded when the parent has maxConcurrent distinct teammates", () => {
      const r = createTeammateRegistry()
      for (let i = 0; i < 3; i++) {
        r.register({ ...DEFAULT_INPUT, name: `t${i}`, sessionID: `s${i}`, maxConcurrent: 3 })
      }
      const blocked = r.register({ ...DEFAULT_INPUT, name: "t3", sessionID: "s3", maxConcurrent: 3 })
      expect(blocked.kind).toBe("capacity_exceeded")
      if (blocked.kind !== "capacity_exceeded") throw new Error("narrow")
      expect(blocked.limit).toBe(3)
      expect(blocked.current).toBe(3)
    })

    it("does NOT count a name-reuse toward capacity", () => {
      const r = createTeammateRegistry()
      for (let i = 0; i < 3; i++) {
        r.register({ ...DEFAULT_INPUT, name: `t${i}`, sessionID: `s${i}`, maxConcurrent: 3 })
      }
      // re-registering an existing name should succeed (it's reuse, not a new slot)
      const reuse = r.register({ ...DEFAULT_INPUT, name: "t1", sessionID: "s1-new", maxConcurrent: 3 })
      expect(reuse.kind).toBe("reused")
    })

    it("enforces capacity per parent, not globally", () => {
      const r = createTeammateRegistry()
      for (let i = 0; i < 3; i++) {
        r.register({ ...DEFAULT_INPUT, name: `t${i}`, sessionID: `s${i}`, maxConcurrent: 3 })
      }
      // a fourth teammate on a DIFFERENT parent is fine
      const otherParent = r.register({
        ...DEFAULT_INPUT,
        name: "t3",
        parentSessionID: "parent-B",
        sessionID: "s3",
        maxConcurrent: 3,
      })
      expect(otherParent.kind).toBe("registered")
    })
  })

  describe("get + list", () => {
    it("get returns the entry by (parent, name)", () => {
      const r = createTeammateRegistry()
      r.register(DEFAULT_INPUT)
      const got = r.get("parent-A", "researcher")
      expect(got?.sessionID).toBe("sess-1")
    })

    it("get returns undefined for unknown parent or name", () => {
      const r = createTeammateRegistry()
      r.register(DEFAULT_INPUT)
      expect(r.get("parent-Z", "researcher")).toBeUndefined()
      expect(r.get("parent-A", "nobody")).toBeUndefined()
    })

    it("list preserves insertion order", () => {
      const r = createTeammateRegistry()
      r.register({ ...DEFAULT_INPUT, name: "first", sessionID: "s1" })
      r.register({ ...DEFAULT_INPUT, name: "second", sessionID: "s2" })
      r.register({ ...DEFAULT_INPUT, name: "third", sessionID: "s3" })
      const list = r.list("parent-A")
      expect(list.map((e) => e.name)).toEqual(["first", "second", "third"])
    })

    it("list returns empty array for unknown parent", () => {
      const r = createTeammateRegistry()
      expect(r.list("parent-Z")).toEqual([])
    })
  })

  describe("touch", () => {
    it("updates lastActivityAt on every call", async () => {
      const r = createTeammateRegistry()
      r.register(DEFAULT_INPUT)
      const before = r.get("parent-A", "researcher")!.lastActivityAt
      await new Promise((res) => setTimeout(res, 2))
      const updated = r.touch("parent-A", "researcher")
      expect(updated?.lastActivityAt).toBeGreaterThan(before)
    })

    it("updates status when provided", () => {
      const r = createTeammateRegistry()
      r.register(DEFAULT_INPUT)
      const updated = r.touch("parent-A", "researcher", "running")
      expect(updated?.status).toBe("running")
    })

    it("leaves status unchanged when omitted", () => {
      const r = createTeammateRegistry()
      r.register(DEFAULT_INPUT)
      r.touch("parent-A", "researcher", "running")
      const again = r.touch("parent-A", "researcher")
      expect(again?.status).toBe("running")
    })

    it("returns undefined for unknown teammate", () => {
      const r = createTeammateRegistry()
      expect(r.touch("parent-Z", "nobody")).toBeUndefined()
    })
  })

  describe("dismiss", () => {
    it("removes the teammate and returns the removed entry", () => {
      const r = createTeammateRegistry()
      r.register(DEFAULT_INPUT)
      const removed = r.dismiss("parent-A", "researcher")
      expect(removed?.sessionID).toBe("sess-1")
      expect(r.get("parent-A", "researcher")).toBeUndefined()
    })

    it("returns undefined when dismissing unknown teammate", () => {
      const r = createTeammateRegistry()
      expect(r.dismiss("parent-A", "nobody")).toBeUndefined()
    })

    it("cleans up the parent's inner map when its last teammate is dismissed", () => {
      const r = createTeammateRegistry()
      r.register(DEFAULT_INPUT)
      r.dismiss("parent-A", "researcher")
      // registering the same name again should NOT behave as reuse
      const fresh = r.register(DEFAULT_INPUT)
      expect(fresh.kind).toBe("registered")
    })

    it("freed slot counts toward capacity again", () => {
      const r = createTeammateRegistry()
      for (let i = 0; i < 3; i++) {
        r.register({ ...DEFAULT_INPUT, name: `t${i}`, sessionID: `s${i}`, maxConcurrent: 3 })
      }
      r.dismiss("parent-A", "t1")
      const afterDismiss = r.register({ ...DEFAULT_INPUT, name: "t3", sessionID: "s3", maxConcurrent: 3 })
      expect(afterDismiss.kind).toBe("registered")
    })
  })

  describe("clearParent", () => {
    it("removes all teammates for a parent and returns the count", () => {
      const r = createTeammateRegistry()
      for (let i = 0; i < 3; i++) {
        r.register({ ...DEFAULT_INPUT, name: `t${i}`, sessionID: `s${i}` })
      }
      expect(r.clearParent("parent-A")).toBe(3)
      expect(r.list("parent-A")).toEqual([])
    })

    it("returns 0 for unknown parent", () => {
      const r = createTeammateRegistry()
      expect(r.clearParent("parent-Z")).toBe(0)
    })

    it("does not touch other parents", () => {
      const r = createTeammateRegistry()
      r.register(DEFAULT_INPUT)
      r.register({ ...DEFAULT_INPUT, parentSessionID: "parent-B", sessionID: "sB" })
      r.clearParent("parent-A")
      expect(r.list("parent-B")).toHaveLength(1)
    })
  })

  describe("snapshot", () => {
    it("returns all entries across parents (test-only)", () => {
      const r = createTeammateRegistry()
      r.register({ ...DEFAULT_INPUT, name: "a", sessionID: "sa" })
      r.register({ ...DEFAULT_INPUT, name: "b", parentSessionID: "parent-B", sessionID: "sb" })
      const all = r.snapshot()
      expect(all).toHaveLength(2)
    })
  })
})
