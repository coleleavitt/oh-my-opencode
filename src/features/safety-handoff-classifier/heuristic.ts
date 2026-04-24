/**
 * Heuristic post-handoff safety classifier.
 *
 * Ported from the shape of cc119's `u88` (cli.2.1.119.aligned.js:302903)
 * — a check that runs on a subagent's output BEFORE it's handed back to
 * the parent, flagging dangerous operations so the parent can decide
 * whether to act on them. cc119 uses a 2-stage LLM classifier (`Oz$`);
 * this port ships a regex heuristic as the v1 default so the
 * infrastructure doesn't need an extra LLM round-trip to be useful.
 *
 * The heuristic is intentionally conservative: we flag patterns that
 * are almost never part of legitimate agent output (rm -rf /,
 * curl|sh, fork bombs, blanket credential dumps). False negatives are
 * expected — this is a defense-in-depth layer, not a primary gate.
 */

export interface SafetyClassifierResult {
  /** Whether the parent should see a SECURITY WARNING before the output. */
  shouldBlock: boolean
  /** Short human-readable reason, present iff shouldBlock. */
  reason?: string
  /** Which classifier produced the decision — "heuristic" today, future
   * "llm-stage1" / "llm-stage2" for richer classifiers. */
  classifier: string
  /** The specific rule that fired, for telemetry + debugging. */
  ruleId?: string
}

interface Rule {
  id: string
  pattern: RegExp
  reason: string
}

/**
 * Patterns that indicate the subagent likely attempted a destructive or
 * credential-exposing operation. Each pattern is anchored just enough to
 * avoid matching the word occurring inside a sentence ("don't do rm -rf
 * on prod"). We match on tool-use arguments and final-message text
 * equally — both are dangerous shapes.
 *
 * Adding a rule: keep the pattern narrow, tie it to a specific attack
 * shape, and prefer specificity over coverage (a false positive
 * produces a SECURITY WARNING for the parent, which is noisy). If a
 * rule starts producing frequent false positives, tighten it or remove
 * it — defense-in-depth means this layer can afford to be incomplete.
 */
const RULES: readonly Rule[] = [
  {
    id: "rm-rf-root",
    pattern: /\brm\s+-[rRf]*[rR]+[rRf]*\s+(\/(\s|$)|~(\s|$|\/)|\$HOME(\s|$|\/)|\*(\s|$))/,
    reason: "subagent issued rm -rf targeting root, home, or a wildcard",
  },
  {
    id: "curl-pipe-shell",
    pattern: /\b(curl|wget)\s[^\n|`]*\|\s*(ba)?sh\b/,
    reason: "subagent piped a network download directly into a shell",
  },
  {
    id: "fork-bomb",
    pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    reason: "subagent emitted a fork-bomb shell pattern",
  },
  {
    id: "env-dump",
    pattern: /\b(env|printenv|export\s+-p)\b[^\n]*\|\s*(curl|wget|nc\b|ssh\b|netcat|bash\s+-c\s+['"]?curl)/,
    reason: "subagent piped environment variables to a network command",
  },
  {
    id: "find-delete-root",
    pattern: /\bfind\s+(\/|~|\$HOME)\s[^\n]*(-delete|-exec\s+rm\b)/,
    reason: "subagent invoked find … -delete / -exec rm starting from root or home",
  },
  {
    id: "dd-to-device",
    // Match /dev/<block-device-family> with any suffix (nvme0n1, sda1, …)
    pattern: /\bdd\s[^\n]*\bof=\/dev\/(sd|nvme|hd|xvd|vd)[a-z0-9]+/,
    reason: "subagent issued dd targeting a raw block device",
  },
  {
    id: "drop-database",
    pattern: /\bdrop\s+database\b\s+(?!if\s+exists)/i,
    reason: "subagent emitted an unqualified DROP DATABASE",
  },
]

export function heuristicClassify(text: string | undefined | null): SafetyClassifierResult {
  if (typeof text !== "string" || text.length === 0) {
    return { shouldBlock: false, classifier: "heuristic" }
  }

  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return {
        shouldBlock: true,
        reason: rule.reason,
        classifier: "heuristic",
        ruleId: rule.id,
      }
    }
  }

  return { shouldBlock: false, classifier: "heuristic" }
}

/** Rendered into the tool result when a block fires. Shape mirrors
 * cc119's response text so operators familiar with either surface
 * see consistent warnings. */
export function formatSecurityWarning(result: SafetyClassifierResult): string {
  if (!result.shouldBlock) return ""
  return `\n\n[SECURITY WARNING] The sub-agent performed actions that may violate security policy. Reason: ${result.reason ?? "unspecified"}. Review the sub-agent's actions carefully before acting on its output.\n`
}
