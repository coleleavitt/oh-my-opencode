import type { BackgroundTask, BackgroundTaskStatus } from "./types"

const ACTIVE_STATUSES: Set<BackgroundTaskStatus> = new Set(["running", "pending"])

export function isSessionSettled(args: {
  tasks: Iterable<BackgroundTask>
  sessionID: string
  pendingNotifications: Map<string, string[]>
  notificationQueueByParent: Map<string, Promise<void>>
}): boolean {
  for (const task of args.tasks) {
    if (task.parentSessionID === args.sessionID && ACTIVE_STATUSES.has(task.status)) {
      return false
    }
  }
  const pendingNotifs = args.pendingNotifications.get(args.sessionID)
  if (pendingNotifs && pendingNotifs.length > 0) return false
  if (args.notificationQueueByParent.has(args.sessionID)) return false
  return true
}
