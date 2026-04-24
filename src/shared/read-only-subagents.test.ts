/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test"
import { isReadOnlySubagent } from "./read-only-subagents"

describe("isReadOnlySubagent", () => {
  it("returns true for known read-only agents", () => {
    for (const name of ["explore", "librarian", "oracle", "argus", "code-reviewer"]) {
      expect(isReadOnlySubagent(name)).toBe(true)
    }
  })

  it("is case-insensitive and trims whitespace", () => {
    expect(isReadOnlySubagent("EXPLORE")).toBe(true)
    expect(isReadOnlySubagent(" librarian ")).toBe(true)
    expect(isReadOnlySubagent("Oracle")).toBe(true)
  })

  it("returns false for mutation-capable primary agents", () => {
    for (const name of ["sisyphus", "hephaestus", "atlas", "prometheus", "sisyphus-junior"]) {
      expect(isReadOnlySubagent(name)).toBe(false)
    }
  })

  it("returns false for undefined, empty, or unknown names", () => {
    expect(isReadOnlySubagent(undefined)).toBe(false)
    expect(isReadOnlySubagent("")).toBe(false)
    expect(isReadOnlySubagent("some-random-agent")).toBe(false)
  })
})
