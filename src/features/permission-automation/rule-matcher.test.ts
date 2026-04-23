import { describe, expect, it } from "bun:test"
import { matchRule, type ToolInvocation } from "./rule-matcher"
import type { PermissionRule } from "../../config/schema/permission-automation"

describe("matchRule", () => {
  describe("#given a single tool_pattern rule", () => {
    const rules: PermissionRule[] = [
      { tool_pattern: "bash", action: "deny" },
    ]

    describe("#when tool matches exactly", () => {
      it("#then returns matched with deny action", () => {
        const result = matchRule({ tool: "bash" }, rules)
        expect(result).toEqual({ matched: true, action: "deny", rule: rules[0] })
      })
    })

    describe("#when tool does not match", () => {
      it("#then returns not matched", () => {
        const result = matchRule({ tool: "edit" }, rules)
        expect(result).toEqual({ matched: false })
      })
    })
  })

  describe("#given a glob tool_pattern rule", () => {
    const rules: PermissionRule[] = [
      { tool_pattern: "grep_app_*", action: "allow" },
    ]

    describe("#when tool matches glob", () => {
      it("#then returns matched", () => {
        const result = matchRule({ tool: "grep_app_searchGitHub" }, rules)
        expect(result).toEqual({ matched: true, action: "allow", rule: rules[0] })
      })
    })

    describe("#when tool does not match glob", () => {
      it("#then returns not matched", () => {
        const result = matchRule({ tool: "webfetch" }, rules)
        expect(result).toEqual({ matched: false })
      })
    })
  })

  describe("#given a rule with command_pattern", () => {
    const rules: PermissionRule[] = [
      { tool_pattern: "bash", command_pattern: "git *", action: "allow" },
    ]

    describe("#when tool and command both match", () => {
      it("#then returns matched", () => {
        const result = matchRule({ tool: "bash", command: "git status" }, rules)
        expect(result).toEqual({ matched: true, action: "allow", rule: rules[0] })
      })
    })

    describe("#when tool matches but command does not", () => {
      it("#then returns not matched", () => {
        const result = matchRule({ tool: "bash", command: "rm -rf /" }, rules)
        expect(result).toEqual({ matched: false })
      })
    })

    describe("#when tool matches but no command provided", () => {
      it("#then returns not matched", () => {
        const result = matchRule({ tool: "bash" }, rules)
        expect(result).toEqual({ matched: false })
      })
    })
  })

  describe("#given multiple rules (first-match-wins)", () => {
    const rules: PermissionRule[] = [
      { tool_pattern: "bash", command_pattern: "npm *", action: "deny" },
      { tool_pattern: "bash", action: "allow" },
      { tool_pattern: "*", action: "ask" },
    ]

    describe("#when first rule matches", () => {
      it("#then returns the first matching rule", () => {
        const result = matchRule({ tool: "bash", command: "npm install" }, rules)
        expect(result).toEqual({ matched: true, action: "deny", rule: rules[0] })
      })
    })

    describe("#when first rule skipped, second matches", () => {
      it("#then returns the second rule", () => {
        // given: command doesn't match "npm *" so first rule skips
        const result = matchRule({ tool: "bash", command: "ls" }, rules)
        expect(result).toEqual({ matched: true, action: "allow", rule: rules[1] })
      })
    })

    describe("#when only wildcard matches", () => {
      it("#then returns the wildcard rule", () => {
        const result = matchRule({ tool: "edit" }, rules)
        expect(result).toEqual({ matched: true, action: "ask", rule: rules[2] })
      })
    })
  })

  describe("#given action types", () => {
    it("#then allow action is returned correctly", () => {
      const rules: PermissionRule[] = [{ tool_pattern: "read", action: "allow" }]
      const result = matchRule({ tool: "read" }, rules)
      expect(result).toEqual({ matched: true, action: "allow", rule: rules[0] })
    })

    it("#then deny action is returned correctly", () => {
      const rules: PermissionRule[] = [{ tool_pattern: "write", action: "deny" }]
      const result = matchRule({ tool: "write" }, rules)
      expect(result).toEqual({ matched: true, action: "deny", rule: rules[0] })
    })

    it("#then ask action is returned correctly", () => {
      const rules: PermissionRule[] = [{ tool_pattern: "bash", action: "ask" }]
      const result = matchRule({ tool: "bash" }, rules)
      expect(result).toEqual({ matched: true, action: "ask", rule: rules[0] })
    })
  })

  describe("#given empty rules", () => {
    it("#then returns not matched", () => {
      const result = matchRule({ tool: "bash" }, [])
      expect(result).toEqual({ matched: false })
    })
  })
})
