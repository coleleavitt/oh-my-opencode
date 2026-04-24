/**
 * Rapid-refill breaker for auto-compaction.
 *
 * Ported from Claude Code cc119 `Ah7` at `cli.2.1.119.aligned.js:359902-359937`
 * (constants `wR7=3, HL6=3, LR7=3` at 359948). Byte-identical to cc118;
 * this is a catch-up port, not a v119-specific feature.
 *
 * The hazard: a session near its context-limit threshold is auto-compacted,
 * then within a couple of turns the user/tool output immediately refills it
 * past the threshold again, triggering a second compaction, then a third,
 * then a fourth — each losing more earlier context for less and less real
 * relief. At some point we should stop, let the session run long, and let
 * the operator intervene, rather than grinding the history into dust.
 *
 * The breaker trips when `LIMIT` consecutive compactions have each been
 * followed by fewer than `TURN_THRESHOLD` assistant turns before the next
 * compaction attempt would fire. Once tripped it stays tripped for the
 * session.
 */

export const RAPID_REFILL_TURN_THRESHOLD = 3
export const RAPID_REFILL_BREAKER_LIMIT = 3

export interface RapidRefillBreaker {
  shouldAllowCompact(sessionID: string): { allowed: true } | { allowed: false; tripped: true; refills: number }
  recordSuccessfulCompact(sessionID: string): void
  recordAssistantTurn(sessionID: string): void
  clearSession(sessionID: string): void
  /** Test-only introspection. */
  snapshot(sessionID: string): { turnsSinceCompact: number | null; refills: number; tripped: boolean }
}

interface SessionState {
  turnsSinceCompact: number | null
  consecutiveRapidRefills: number
  tripped: boolean
}

export function createRapidRefillBreaker(): RapidRefillBreaker {
  const state = new Map<string, SessionState>()

  const get = (sessionID: string): SessionState => {
    let s = state.get(sessionID)
    if (!s) {
      s = { turnsSinceCompact: null, consecutiveRapidRefills: 0, tripped: false }
      state.set(sessionID, s)
    }
    return s
  }

  return {
    shouldAllowCompact(sessionID) {
      const s = get(sessionID)
      if (s.tripped) {
        return { allowed: false, tripped: true, refills: s.consecutiveRapidRefills }
      }
      if (s.turnsSinceCompact !== null && s.turnsSinceCompact < RAPID_REFILL_TURN_THRESHOLD) {
        const next = s.consecutiveRapidRefills + 1
        if (next >= RAPID_REFILL_BREAKER_LIMIT) {
          s.consecutiveRapidRefills = next
          s.tripped = true
          return { allowed: false, tripped: true, refills: next }
        }
        s.consecutiveRapidRefills = next
        return { allowed: true }
      }
      s.consecutiveRapidRefills = 0
      return { allowed: true }
    },
    recordSuccessfulCompact(sessionID) {
      const s = get(sessionID)
      s.turnsSinceCompact = 0
    },
    recordAssistantTurn(sessionID) {
      const s = get(sessionID)
      if (s.turnsSinceCompact !== null) s.turnsSinceCompact++
    },
    clearSession(sessionID) {
      state.delete(sessionID)
    },
    snapshot(sessionID) {
      const s = state.get(sessionID)
      if (!s) return { turnsSinceCompact: null, refills: 0, tripped: false }
      return {
        turnsSinceCompact: s.turnsSinceCompact,
        refills: s.consecutiveRapidRefills,
        tripped: s.tripped,
      }
    },
  }
}
