/// <reference types="bun-types" />

import { describe, expect, it, mock } from "bun:test"
import { createListTeammates, createDismissTeammate } from "./teammate-admin"
import { createTeammateRegistry } from "../features/teammates"

const ctx = (sessionID = "parent-A") =>
  ({
    sessionID,
    messageID: "msg-1",
    agent: "sisyphus",
    abort: new AbortController().signal,
    metadata: mock(async () => {}),
  }) as never

const makeClient = (abortImpl?: (arg: unknown) => Promise<unknown>) => ({
  session: {
    abort: abortImpl ?? mock(async () => ({})),
  },
}) as never

describe("list_teammates", () => {
  it("returns empty-state message with spawn hint when no teammates", async () => {
    const tool = createListTeammates({
      client: makeClient(),
      teammateRegistry: createTeammateRegistry(),
      teammatesConfig: { enabled: true, max_concurrent: 5 },
    })
    const out = String(await tool.execute({}, ctx()))
    expect(out).toContain("No teammates registered")
    expect(out).toContain("task(teammate=true")
  })

  it("returns a markdown table with registered teammates", async () => {
    const reg = createTeammateRegistry()
    reg.register({ name: "alpha", sessionID: "sA", agent: "explore", parentSessionID: "parent-A", maxConcurrent: 5 })
    reg.register({ name: "beta", sessionID: "sB", agent: "librarian", parentSessionID: "parent-A", maxConcurrent: 5 })
    const tool = createListTeammates({
      client: makeClient(),
      teammateRegistry: reg,
      teammatesConfig: { enabled: true, max_concurrent: 5 },
    })
    const out = String(await tool.execute({}, ctx()))
    expect(out).toContain("| name | agent | status | age |")
    expect(out).toContain("| alpha | explore | pending |")
    expect(out).toContain("| beta | librarian | pending |")
  })

  it("only lists teammates for the current parent session", async () => {
    const reg = createTeammateRegistry()
    reg.register({ name: "mine", sessionID: "sM", agent: "explore", parentSessionID: "parent-A", maxConcurrent: 5 })
    reg.register({ name: "theirs", sessionID: "sT", agent: "explore", parentSessionID: "parent-B", maxConcurrent: 5 })
    const tool = createListTeammates({
      client: makeClient(),
      teammateRegistry: reg,
      teammatesConfig: { enabled: true, max_concurrent: 5 },
    })
    const out = String(await tool.execute({}, ctx("parent-A")))
    expect(out).toContain("mine")
    expect(out).not.toContain("theirs")
  })

  it("reports disabled when feature off", async () => {
    const tool = createListTeammates({
      client: makeClient(),
      teammateRegistry: createTeammateRegistry(),
      teammatesConfig: { enabled: false, max_concurrent: 5 },
    })
    const out = String(await tool.execute({}, ctx()))
    expect(out).toContain("disabled")
  })
})

describe("dismiss_teammate", () => {
  it("aborts the session + removes the entry + frees the slot", async () => {
    const reg = createTeammateRegistry()
    reg.register({ name: "researcher", sessionID: "sess-123abc456", agent: "explore", parentSessionID: "parent-A", maxConcurrent: 5 })
    const abortCalls: unknown[] = []
    const tool = createDismissTeammate({
      client: makeClient(async (arg) => { abortCalls.push(arg); return {} }),
      teammateRegistry: reg,
      teammatesConfig: { enabled: true, max_concurrent: 5 },
    })
    const out = String(await tool.execute({ name: "researcher" }, ctx()))
    expect(out).toContain("Dismissed teammate")
    expect(abortCalls).toHaveLength(1)
    expect((abortCalls[0] as { path: { id: string } }).path.id).toBe("sess-123abc456")
    expect(reg.get("parent-A", "researcher")).toBeUndefined()
  })

  it("removes the registry entry even when abort throws", async () => {
    const reg = createTeammateRegistry()
    reg.register({ name: "broken", sessionID: "sX", agent: "explore", parentSessionID: "parent-A", maxConcurrent: 5 })
    const tool = createDismissTeammate({
      client: makeClient(async () => { throw new Error("session already gone") }),
      teammateRegistry: reg,
      teammatesConfig: { enabled: true, max_concurrent: 5 },
    })
    const out = String(await tool.execute({ name: "broken" }, ctx()))
    expect(out).toContain("Dismissed teammate")
    expect(reg.get("parent-A", "broken")).toBeUndefined()
  })

  it("returns a clear 'no such teammate' message when name is unknown", async () => {
    const reg = createTeammateRegistry()
    const abort = mock(async () => ({}))
    const tool = createDismissTeammate({
      client: { session: { abort } } as never,
      teammateRegistry: reg,
      teammatesConfig: { enabled: true, max_concurrent: 5 },
    })
    const out = String(await tool.execute({ name: "ghost" }, ctx()))
    expect(out).toContain('No teammate named "ghost"')
    expect(abort).not.toHaveBeenCalled()
  })

  it("is scoped per parent — dismissing in parent-A leaves parent-B's same-named teammate alone", async () => {
    const reg = createTeammateRegistry()
    reg.register({ name: "shared", sessionID: "sA", agent: "explore", parentSessionID: "parent-A", maxConcurrent: 5 })
    reg.register({ name: "shared", sessionID: "sB", agent: "explore", parentSessionID: "parent-B", maxConcurrent: 5 })
    const tool = createDismissTeammate({
      client: makeClient(),
      teammateRegistry: reg,
      teammatesConfig: { enabled: true, max_concurrent: 5 },
    })
    await tool.execute({ name: "shared" }, ctx("parent-A"))
    expect(reg.get("parent-A", "shared")).toBeUndefined()
    expect(reg.get("parent-B", "shared")?.sessionID).toBe("sB")
  })
})
