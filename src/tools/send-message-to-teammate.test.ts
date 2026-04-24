/// <reference types="bun-types" />

import { describe, expect, it, mock } from "bun:test"
import { createSendMessageToTeammate } from "./send-message-to-teammate"
import { createTeammateRegistry } from "../features/teammates"

const makeCtx = (sessionID = "parent-A") => ({
  sessionID,
  messageID: "msg-1",
  agent: "sisyphus",
  abort: new AbortController().signal,
  metadata: mock(async () => {}),
})

const makeOptions = (overrides: Partial<Parameters<typeof createSendMessageToTeammate>[0]> = {}) => {
  // Stub out manager + client with shapes only — we only exercise the
  // registry-lookup decision tree in this file; the executor path is
  // covered by delegate-task's own continuation tests.
  return {
    client: {} as never,
    manager: {} as never,
    directory: "/tmp/fake",
    teammateRegistry: createTeammateRegistry(),
    teammatesConfig: { enabled: true, max_concurrent: 5 },
    ...overrides,
  }
}

describe("send_message_to_teammate tool — registry decisions", () => {
  it("returns a disabled-feature error when teammatesConfig.enabled is false", async () => {
    const options = makeOptions({ teammatesConfig: { enabled: false, max_concurrent: 5 } })
    const tool = createSendMessageToTeammate(options)
    const res = await tool.execute(
      { name: "researcher", prompt: "hi", run_in_background: false },
      makeCtx() as never,
    )
    expect(String(res)).toContain("Teammates feature is disabled")
  })

  it("returns a disabled error when the registry is absent", async () => {
    const options = makeOptions({ teammateRegistry: undefined })
    const tool = createSendMessageToTeammate(options)
    const res = await tool.execute(
      { name: "researcher", prompt: "hi", run_in_background: false },
      makeCtx() as never,
    )
    expect(String(res)).toContain("Teammates feature is disabled")
  })

  it("returns an invalid-args error when name is empty", async () => {
    const options = makeOptions()
    const tool = createSendMessageToTeammate(options)
    const res = await tool.execute(
      { name: "", prompt: "hi", run_in_background: false },
      makeCtx() as never,
    )
    expect(String(res)).toContain("name is required")
  })

  it("returns 'no teammates registered' error when parent has none", async () => {
    const options = makeOptions()
    const tool = createSendMessageToTeammate(options)
    const res = await tool.execute(
      { name: "researcher", prompt: "hi", run_in_background: false },
      makeCtx() as never,
    )
    expect(String(res)).toContain('Unknown teammate "researcher"')
    expect(String(res)).toContain("No teammates registered")
  })

  it("returns a 'known teammates' error listing names when parent has others", async () => {
    const registry = createTeammateRegistry()
    registry.register({ name: "alpha", sessionID: "sA", agent: "explore", parentSessionID: "parent-A", maxConcurrent: 5 })
    registry.register({ name: "beta", sessionID: "sB", agent: "librarian", parentSessionID: "parent-A", maxConcurrent: 5 })
    const options = makeOptions({ teammateRegistry: registry })
    const tool = createSendMessageToTeammate(options)
    const res = await tool.execute(
      { name: "researcher", prompt: "hi", run_in_background: false },
      makeCtx() as never,
    )
    const str = String(res)
    expect(str).toContain('Unknown teammate "researcher"')
    expect(str).toContain('"alpha" (explore)')
    expect(str).toContain('"beta" (librarian)')
  })

  it("looks up by (parentSessionID, name) — does not find teammates from a different parent", async () => {
    const registry = createTeammateRegistry()
    registry.register({ name: "researcher", sessionID: "sX", agent: "explore", parentSessionID: "parent-OTHER", maxConcurrent: 5 })
    const options = makeOptions({ teammateRegistry: registry })
    const tool = createSendMessageToTeammate(options)
    const res = await tool.execute(
      { name: "researcher", prompt: "hi", run_in_background: false },
      makeCtx("parent-A") as never,
    )
    expect(String(res)).toContain('Unknown teammate "researcher"')
  })
})
