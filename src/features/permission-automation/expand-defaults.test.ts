import { describe, expect, it } from "bun:test"
import { expandDefaults } from "./expand-defaults"
import { DEFAULT_ALLOW_RULES } from "./defaults"
import type { PermissionRule } from "../../config/schema/permission-automation"

describe("expandDefaults", () => {
  const customRule: PermissionRule = { tool_pattern: "edit", action: "deny" }
  const customRule2: PermissionRule = { tool_pattern: "write", action: "ask" }

  describe("#given empty array", () => {
    it("#then returns empty array", () => {
      // when
      const result = expandDefaults([])

      // then
      expect(result).toEqual([])
    })
  })

  describe("#given ['$defaults'] only", () => {
    it("#then returns full DEFAULT_ALLOW_RULES", () => {
      // when
      const result = expandDefaults(["$defaults"])

      // then
      expect(result).toEqual([...DEFAULT_ALLOW_RULES])
      expect(result).toHaveLength(DEFAULT_ALLOW_RULES.length)
    })
  })

  describe("#given ['$defaults', customRule]", () => {
    it("#then returns DEFAULT_ALLOW_RULES followed by customRule", () => {
      // when
      const result = expandDefaults(["$defaults", customRule])

      // then
      expect(result).toEqual([...DEFAULT_ALLOW_RULES, customRule])
    })
  })

  describe("#given [customRule, '$defaults']", () => {
    it("#then returns customRule followed by DEFAULT_ALLOW_RULES", () => {
      // when
      const result = expandDefaults([customRule, "$defaults"])

      // then
      expect(result).toEqual([customRule, ...DEFAULT_ALLOW_RULES])
    })
  })

  describe("#given ['$defaults', '$defaults']", () => {
    it("#then returns two copies of DEFAULT_ALLOW_RULES", () => {
      // when
      const result = expandDefaults(["$defaults", "$defaults"])

      // then
      expect(result).toEqual([...DEFAULT_ALLOW_RULES, ...DEFAULT_ALLOW_RULES])
      expect(result).toHaveLength(DEFAULT_ALLOW_RULES.length * 2)
    })
  })

  describe("#given [customRule1, customRule2] without $defaults", () => {
    it("#then returns just those two rules", () => {
      // when
      const result = expandDefaults([customRule, customRule2])

      // then
      expect(result).toEqual([customRule, customRule2])
    })
  })

  describe("#given custom defaults override", () => {
    it("#then uses provided defaults instead of DEFAULT_ALLOW_RULES", () => {
      // given
      const customDefaults: PermissionRule[] = [
        { tool_pattern: "bash", command_pattern: "echo *", action: "allow" },
      ]

      // when
      const result = expandDefaults(["$defaults", customRule], customDefaults)

      // then
      expect(result).toEqual([...customDefaults, customRule])
      expect(result).not.toEqual(expect.arrayContaining([...DEFAULT_ALLOW_RULES]))
    })
  })
})
