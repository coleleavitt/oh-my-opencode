import type { PermissionRule, PermissionRuleEntry } from "../../config/schema/permission-automation"
import { DEFAULT_ALLOW_RULES } from "./defaults"

export type { PermissionRuleEntry }

export function expandDefaults(
  entries: readonly PermissionRuleEntry[],
  defaults: readonly PermissionRule[] = DEFAULT_ALLOW_RULES,
): PermissionRule[] {
  const result: PermissionRule[] = []
  for (const entry of entries) {
    if (entry === "$defaults") {
      result.push(...defaults)
    } else {
      result.push(entry)
    }
  }
  return result
}
