import { describe, test, expect } from "bun:test"
import { isSessionSettled } from "./session-settlement-checker"
import type { BackgroundTask } from "./types"

function createTask(overrides: Partial<BackgroundTask> & { parentSessionID: string; status: BackgroundTask["status"] }): BackgroundTask {
  return {
    id: `task-${Math.random().toString(36).slice(2, 8)}`,
    parentSessionID: overrides.parentSessionID,
    parentMessageID: "msg-1",
    description: "test",
    prompt: "test",
    agent: "test",
    status: overrides.status,
    ...overrides,
  }
}

describe("isSessionSettled", () => {
  test("#given no tasks and no pending notifications #when checking settlement #then returns true", () => {
    const result = isSessionSettled({
      tasks: [],
      sessionID: "ses-1",
      pendingNotifications: new Map(),
      notificationQueueByParent: new Map(),
    })
    expect(result).toBe(true)
  })

  test("#given running task for session #when checking settlement #then returns false", () => {
    const task = createTask({ parentSessionID: "ses-1", status: "running" })
    const result = isSessionSettled({
      tasks: [task],
      sessionID: "ses-1",
      pendingNotifications: new Map(),
      notificationQueueByParent: new Map(),
    })
    expect(result).toBe(false)
  })

  test("#given pending task for session #when checking settlement #then returns false", () => {
    const task = createTask({ parentSessionID: "ses-1", status: "pending" })
    const result = isSessionSettled({
      tasks: [task],
      sessionID: "ses-1",
      pendingNotifications: new Map(),
      notificationQueueByParent: new Map(),
    })
    expect(result).toBe(false)
  })

  test("#given completed task for session #when checking settlement #then returns true", () => {
    const task = createTask({ parentSessionID: "ses-1", status: "completed" })
    const result = isSessionSettled({
      tasks: [task],
      sessionID: "ses-1",
      pendingNotifications: new Map(),
      notificationQueueByParent: new Map(),
    })
    expect(result).toBe(true)
  })

  test("#given notification queue promise pending #when checking settlement #then returns false", () => {
    const queueByParent = new Map<string, Promise<void>>()
    queueByParent.set("ses-1", Promise.resolve())
    const result = isSessionSettled({
      tasks: [],
      sessionID: "ses-1",
      pendingNotifications: new Map(),
      notificationQueueByParent: queueByParent,
    })
    expect(result).toBe(false)
  })

  test("#given pending notifications exist #when checking settlement #then returns false", () => {
    const pendingNotifications = new Map<string, string[]>()
    pendingNotifications.set("ses-1", ["<system-reminder>task done</system-reminder>"])
    const result = isSessionSettled({
      tasks: [],
      sessionID: "ses-1",
      pendingNotifications,
      notificationQueueByParent: new Map(),
    })
    expect(result).toBe(false)
  })

  test("#given empty pending notifications array #when checking settlement #then returns true", () => {
    const pendingNotifications = new Map<string, string[]>()
    pendingNotifications.set("ses-1", [])
    const result = isSessionSettled({
      tasks: [],
      sessionID: "ses-1",
      pendingNotifications,
      notificationQueueByParent: new Map(),
    })
    expect(result).toBe(true)
  })

  test("#given tasks for different session #when checking settlement #then returns true", () => {
    const task = createTask({ parentSessionID: "ses-other", status: "running" })
    const result = isSessionSettled({
      tasks: [task],
      sessionID: "ses-1",
      pendingNotifications: new Map(),
      notificationQueueByParent: new Map(),
    })
    expect(result).toBe(true)
  })
})
