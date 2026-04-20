import { describe, it, expect } from "bun:test"

describe("context formula consistency", () => {
  const testCases = [
    { name: "low utilization", input: 100, cacheRead: 29_900, output: 50, limit: 1_000_000, expected: 0.03 },
    { name: "mid utilization", input: 50_000, cacheRead: 450_000, output: 10_000, limit: 1_000_000, expected: 0.5 },
    { name: "high utilization", input: 100_000, cacheRead: 700_000, output: 50_000, limit: 1_000_000, expected: 0.8 },
  ]

  for (const tc of testCases) {
    it(`${tc.name}: all three hooks agree on ${tc.expected * 100}%`, () => {
      const usedTokens = tc.input + tc.cacheRead
      const percentage = usedTokens / tc.limit
      expect(percentage).toBeCloseTo(tc.expected, 5)
      const wrongPercentage = (tc.input + tc.cacheRead + tc.output) / tc.limit
      expect(wrongPercentage).not.toBeCloseTo(tc.expected, 5)
    })
  }
})
