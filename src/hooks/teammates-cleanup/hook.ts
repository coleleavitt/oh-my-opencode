import type { TeammateRegistry } from "../../features/teammates"
import { log } from "../../shared/logger"

interface EventInput {
  event: {
    type: string
    properties?: unknown
  }
}

/**
 * Session-end cleanup for the teammate registry.
 *
 * When a parent session is deleted, drop all its teammates from the
 * registry. Without this, long-running omo processes accumulate stale
 * entries: teammates whose parent is gone still count toward the next
 * parent's capacity (they don't — registry is per-parent — but the
 * entries leak memory and show up in debugging).
 *
 * The underlying sub-sessions terminate on their own when the OpenCode
 * host cleans them up; this hook only owns the registry side.
 */
export function createTeammatesCleanupHook(registry: TeammateRegistry | undefined) {
  return {
    event: async ({ event }: EventInput) => {
      if (!registry) return
      if (event.type !== "session.deleted") return
      const props = event.properties as { info?: { id?: string } } | undefined
      const sessionID = props?.info?.id
      if (!sessionID) return
      const cleared = registry.clearParent(sessionID)
      if (cleared > 0) {
        log("[teammates-cleanup] cleared teammates on parent session.deleted", {
          parentSessionID: sessionID,
          cleared,
        })
      }
    },
  }
}
