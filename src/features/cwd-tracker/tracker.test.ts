import { describe, expect, it, beforeEach } from "bun:test"
import { parseCdTarget, recordCwdChange, clearCwdState } from "./tracker"
import * as os from "node:os"

describe("parseCdTarget", () => {
  const cwd = "/home/foo"

  describe("#given absolute cd", () => {
    it("#then returns the absolute path", () => {
      expect(parseCdTarget("cd /home/bar", cwd)).toBe("/home/bar")
    })
  })

  describe("#given relative cd", () => {
    it("#then resolves relative to current cwd", () => {
      expect(parseCdTarget("cd src", cwd)).toBe("/home/foo/src")
    })
  })

  describe("#given cd with tilde", () => {
    it("#then expands to home directory", () => {
      expect(parseCdTarget("cd ~/bar", cwd)).toBe(`${os.homedir()}/bar`)
    })
  })

  describe("#given bare cd", () => {
    it("#then returns home directory", () => {
      expect(parseCdTarget("cd", cwd)).toBe(os.homedir())
    })
  })

  describe("#given composite command with multiple cds", () => {
    it("#then returns the final cd target", () => {
      expect(parseCdTarget("cd /tmp && cd subdir", cwd)).toBe("/tmp/subdir")
    })
  })

  describe("#given composite with semicolons", () => {
    it("#then returns the final cd target", () => {
      expect(parseCdTarget("cd /a; cd /b", cwd)).toBe("/b")
    })
  })

  describe("#given subshell cd", () => {
    it("#then returns null (no parent cwd change)", () => {
      expect(parseCdTarget("(cd /tmp)", cwd)).toBeNull()
    })
  })

  describe("#given quoted path", () => {
    it("#then strips double quotes", () => {
      expect(parseCdTarget('cd "path with space"', cwd)).toBe(
        "/home/foo/path with space",
      )
    })

    it("#then strips single quotes", () => {
      expect(parseCdTarget("cd 'another path'", cwd)).toBe(
        "/home/foo/another path",
      )
    })
  })

  describe("#given non-cd command", () => {
    it("#then returns null", () => {
      expect(parseCdTarget("ls -la", cwd)).toBeNull()
    })
  })

  describe("#given cd -", () => {
    it("#then returns the sentinel", () => {
      expect(parseCdTarget("cd -", cwd)).toBe("-")
    })
  })

  describe("#given empty string", () => {
    it("#then returns null", () => {
      expect(parseCdTarget("", cwd)).toBeNull()
    })
  })

  describe("#given cd after other commands", () => {
    it("#then detects the cd", () => {
      expect(parseCdTarget("echo hello && cd /opt", cwd)).toBe("/opt")
    })
  })
})

describe("recordCwdChange", () => {
  const sessionID = "test-session"
  const parentCwd = "/home/user"

  beforeEach(() => {
    clearCwdState(sessionID)
  })

  describe("#given a cd command", () => {
    it("#then reports changed with old and new cwd", () => {
      const result = recordCwdChange(sessionID, "cd /tmp", parentCwd)
      expect(result).toEqual({
        changed: true,
        oldCwd: "/home/user",
        newCwd: "/tmp",
      })
    })
  })

  describe("#given a non-cd command", () => {
    it("#then reports not changed", () => {
      const result = recordCwdChange(sessionID, "ls", parentCwd)
      expect(result).toEqual({ changed: false })
    })
  })

  describe("#given cd to same directory", () => {
    it("#then reports not changed", () => {
      const result = recordCwdChange(sessionID, "cd /home/user", parentCwd)
      expect(result).toEqual({ changed: false })
    })
  })

  describe("#given cd - with previous directory", () => {
    it("#then swaps back to previous cwd", () => {
      // given
      recordCwdChange(sessionID, "cd /tmp", parentCwd)

      // when
      const result = recordCwdChange(sessionID, "cd -", parentCwd)

      // then
      expect(result).toEqual({
        changed: true,
        oldCwd: "/tmp",
        newCwd: "/home/user",
      })
    })
  })

  describe("#given cd - without previous directory", () => {
    it("#then reports not changed", () => {
      const result = recordCwdChange(sessionID, "cd -", parentCwd)
      expect(result).toEqual({ changed: false })
    })
  })
})
