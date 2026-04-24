import type {
  TeammateEntry,
  TeammateRegistry,
  TeammateStatus,
  RegisterInput,
  RegisterResult,
} from "./types"

/**
 * In-memory teammate registry.
 *
 * Storage shape: Map<parentSessionID, Map<name, TeammateEntry>>. The
 * inner map is keyed by name (not by sessionID) because lookups are
 * always "this parent → that teammate by name." Insertion order is
 * preserved per inner map (native Map behavior), which `list` relies on.
 *
 * The registry is deliberately local — no persistence across plugin
 * restarts, no cross-directory sharing. A teammate exists only while
 * its parent session exists; session.deleted clears the parent's
 * entries via clearParent.
 */
export function createTeammateRegistry(): TeammateRegistry {
  const byParent = new Map<string, Map<string, TeammateEntry>>()

  const getInner = (parentSessionID: string): Map<string, TeammateEntry> | undefined =>
    byParent.get(parentSessionID)

  const ensureInner = (parentSessionID: string): Map<string, TeammateEntry> => {
    let inner = byParent.get(parentSessionID)
    if (!inner) {
      inner = new Map()
      byParent.set(parentSessionID, inner)
    }
    return inner
  }

  return {
    register(input: RegisterInput): RegisterResult {
      const inner = ensureInner(input.parentSessionID)
      const existing = inner.get(input.name)
      if (existing) {
        // Reuse on name collision — DESIGN.md decision #2. Update the
        // backing sessionID + agent in case the caller genuinely means
        // "re-bind this name to a fresh session" (e.g. the prior session
        // was dismissed or errored and the parent is respawning).
        existing.sessionID = input.sessionID
        existing.agent = input.agent
        existing.status = "pending"
        existing.lastActivityAt = Date.now()
        return { kind: "reused", entry: existing, reused: true }
      }

      if (inner.size >= input.maxConcurrent) {
        return { kind: "capacity_exceeded", limit: input.maxConcurrent, current: inner.size }
      }

      const now = Date.now()
      const entry: TeammateEntry = {
        name: input.name,
        sessionID: input.sessionID,
        agent: input.agent,
        status: "pending",
        parentSessionID: input.parentSessionID,
        lastActivityAt: now,
        createdAt: now,
      }
      inner.set(input.name, entry)
      return { kind: "registered", entry, reused: false }
    },

    get(parentSessionID: string, name: string): TeammateEntry | undefined {
      return getInner(parentSessionID)?.get(name)
    },

    list(parentSessionID: string): TeammateEntry[] {
      const inner = getInner(parentSessionID)
      if (!inner) return []
      return Array.from(inner.values())
    },

    touch(
      parentSessionID: string,
      name: string,
      status?: TeammateStatus,
    ): TeammateEntry | undefined {
      const entry = getInner(parentSessionID)?.get(name)
      if (!entry) return undefined
      entry.lastActivityAt = Date.now()
      if (status) entry.status = status
      return entry
    },

    dismiss(parentSessionID: string, name: string): TeammateEntry | undefined {
      const inner = getInner(parentSessionID)
      if (!inner) return undefined
      const entry = inner.get(name)
      if (!entry) return undefined
      inner.delete(name)
      if (inner.size === 0) byParent.delete(parentSessionID)
      return entry
    },

    clearParent(parentSessionID: string): number {
      const inner = getInner(parentSessionID)
      if (!inner) return 0
      const count = inner.size
      byParent.delete(parentSessionID)
      return count
    },

    snapshot(): readonly TeammateEntry[] {
      const result: TeammateEntry[] = []
      for (const inner of byParent.values()) {
        for (const entry of inner.values()) result.push(entry)
      }
      return result
    },
  }
}
