/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test"
import {
  createRapidRefillBreaker,
  RAPID_REFILL_BREAKER_LIMIT,
  RAPID_REFILL_TURN_THRESHOLD,
} from "./rapid-refill-breaker"

describe("rapidRefillBreaker.shouldAllowCompact", () => {
  it("allows the first-ever compaction for a session", () => {
    const b = createRapidRefillBreaker()
    expect(b.shouldAllowCompact("s1")).toEqual({ allowed: true })
  })

  it("allows a second compaction after TURN_THRESHOLD turns have elapsed", () => {
    const b = createRapidRefillBreaker()
    b.shouldAllowCompact("s1")
    b.recordSuccessfulCompact("s1")
    for (let i = 0; i < RAPID_REFILL_TURN_THRESHOLD; i++) b.recordAssistantTurn("s1")
    expect(b.shouldAllowCompact("s1")).toEqual({ allowed: true })
  })

  it("resets the refill counter when a compaction is followed by >= TURN_THRESHOLD turns", () => {
    const b = createRapidRefillBreaker()
    b.shouldAllowCompact("s1")
    b.recordSuccessfulCompact("s1")
    // rapid: only 1 turn before next attempt
    b.recordAssistantTurn("s1")
    b.shouldAllowCompact("s1")
    b.recordSuccessfulCompact("s1")
    // slow: 3 turns before next attempt — should reset
    for (let i = 0; i < RAPID_REFILL_TURN_THRESHOLD; i++) b.recordAssistantTurn("s1")
    b.shouldAllowCompact("s1")
    expect(b.snapshot("s1").refills).toBe(0)
  })

  it("counts consecutive rapid refills and trips on the LIMIT-th attempt", () => {
    const b = createRapidRefillBreaker()
    // first attempt: never compacted before → allowed, counter stays 0
    expect(b.shouldAllowCompact("s1")).toEqual({ allowed: true })
    b.recordSuccessfulCompact("s1")

    // rapid refills 1..LIMIT-1 are allowed but increment the counter
    for (let i = 1; i < RAPID_REFILL_BREAKER_LIMIT; i++) {
      b.recordAssistantTurn("s1") // only 1 turn before next compact attempt
      const r = b.shouldAllowCompact("s1")
      expect(r).toEqual({ allowed: true })
      expect(b.snapshot("s1").refills).toBe(i)
      b.recordSuccessfulCompact("s1")
    }

    // LIMIT-th rapid refill trips the breaker
    b.recordAssistantTurn("s1")
    const tripped = b.shouldAllowCompact("s1")
    expect(tripped).toEqual({ allowed: false, tripped: true, refills: RAPID_REFILL_BREAKER_LIMIT })
    expect(b.snapshot("s1").tripped).toBe(true)
  })

  it("stays tripped for subsequent compaction attempts on the same session", () => {
    const b = createRapidRefillBreaker()
    b.shouldAllowCompact("s1")
    b.recordSuccessfulCompact("s1")
    for (let i = 1; i <= RAPID_REFILL_BREAKER_LIMIT; i++) {
      b.recordAssistantTurn("s1")
      const r = b.shouldAllowCompact("s1")
      if (i < RAPID_REFILL_BREAKER_LIMIT) b.recordSuccessfulCompact("s1")
      else expect(r).toEqual({ allowed: false, tripped: true, refills: RAPID_REFILL_BREAKER_LIMIT })
    }
    // even after many more turns, still tripped
    for (let i = 0; i < 100; i++) b.recordAssistantTurn("s1")
    const stillTripped = b.shouldAllowCompact("s1")
    expect(stillTripped).toMatchObject({ allowed: false, tripped: true })
  })

  it("tracks sessions independently", () => {
    const b = createRapidRefillBreaker()
    // trip session A
    b.shouldAllowCompact("A"); b.recordSuccessfulCompact("A")
    for (let i = 1; i <= RAPID_REFILL_BREAKER_LIMIT; i++) {
      b.recordAssistantTurn("A")
      b.shouldAllowCompact("A")
      if (i < RAPID_REFILL_BREAKER_LIMIT) b.recordSuccessfulCompact("A")
    }
    expect(b.snapshot("A").tripped).toBe(true)
    // session B is unaffected
    expect(b.shouldAllowCompact("B")).toEqual({ allowed: true })
    expect(b.snapshot("B").tripped).toBe(false)
  })

  it("clearSession wipes state so the session starts fresh", () => {
    const b = createRapidRefillBreaker()
    b.shouldAllowCompact("s1"); b.recordSuccessfulCompact("s1")
    for (let i = 1; i <= RAPID_REFILL_BREAKER_LIMIT; i++) {
      b.recordAssistantTurn("s1")
      b.shouldAllowCompact("s1")
      if (i < RAPID_REFILL_BREAKER_LIMIT) b.recordSuccessfulCompact("s1")
    }
    expect(b.snapshot("s1").tripped).toBe(true)
    b.clearSession("s1")
    expect(b.snapshot("s1")).toEqual({ turnsSinceCompact: null, refills: 0, tripped: false })
    expect(b.shouldAllowCompact("s1")).toEqual({ allowed: true })
  })

  it("does not increment the refill counter on the first-ever compact (no prior state)", () => {
    const b = createRapidRefillBreaker()
    expect(b.shouldAllowCompact("s1")).toEqual({ allowed: true })
    expect(b.snapshot("s1").refills).toBe(0)
  })

  it("recordAssistantTurn is a no-op when no prior compaction", () => {
    const b = createRapidRefillBreaker()
    for (let i = 0; i < 10; i++) b.recordAssistantTurn("s1")
    expect(b.snapshot("s1").turnsSinceCompact).toBeNull()
  })
})
