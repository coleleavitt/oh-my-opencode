import { describe, expect, it } from "bun:test";
import type { Confidence, PLevel } from "../../config/schema/argus-auto-review";
import { ARGUS_OUTPUT_FIXTURE } from "./p-level-parser.test-fixtures";
import {
  filterByConfidence,
  formatBlockMessage,
  parseArgusFindings,
  shouldBlock,
} from "./p-level-parser";

describe("p-level-parser", () => {
  describe("#given the Argus output fixture", () => {
    const findings = parseArgusFindings(ARGUS_OUTPUT_FIXTURE);

    describe("parseArgusFindings", () => {
      it("#then returns exactly 2 findings", () => {
        expect(findings).toHaveLength(2);
      });

      it("#then parses Finding #1 correctly", () => {
        const f1 = findings[0];
        expect(f1).toMatchObject({
          number: 1,
          title: "Null pointer dereference on auth token refresh",
          priority: "P-1",
          priorityLabel: "BLOCKER",
          impact: "CRITICAL",
          trigger: "ALWAYS",
          blastRadius: "MODULE",
          fixEffort: "TRIVIAL",
          confidence: "certain",
          location: "src/auth/token-manager.ts:67",
        });
        expect(f1.issue).toStartWith(
          "`refreshed.accessToken.toString()` assumes refreshed is non-null",
        );
        expect(f1.recommendation).toBeDefined();
        expect(f1.rationale).toBeDefined();
      });

      it("#then parses Finding #2 correctly", () => {
        const f2 = findings[1];
        expect(f2).toMatchObject({
          number: 2,
          title: "Race condition in cache eviction",
          priority: "P-3",
          priorityLabel: "MEDIUM",
          impact: "MEDIUM",
          trigger: "RARE",
          blastRadius: "FILE",
          fixEffort: "MODERATE",
          confidence: "high",
          location: "src/cache/manager.ts:142-158",
        });
        expect(f2.issue).toStartWith(
          "The eviction loop iterates `this.entries` without locking",
        );
      });

      it("#then normalizes confidence to lowercase", () => {
        expect(findings[0].confidence).toBe("certain");
        expect(findings[1].confidence).toBe("high");
      });

      it("#then includes raw block text", () => {
        expect(findings[0].raw).toContain("Finding #1");
        expect(findings[1].raw).toContain("Finding #2");
      });
    });

    describe("shouldBlock", () => {
      it("#when blockOnPLevels includes P-1 #then returns true", () => {
        expect(shouldBlock(findings, ["P-1"])).toBe(true);
      });

      it("#when blockOnPLevels includes P-3 #then returns true", () => {
        expect(shouldBlock(findings, ["P-3"])).toBe(true);
      });

      it("#when blockOnPLevels is P-2 only #then returns false", () => {
        expect(shouldBlock(findings, ["P-2"])).toBe(false);
      });

      it("#when blockOnPLevels is empty #then returns false", () => {
        expect(shouldBlock(findings, [])).toBe(false);
      });

      it("#when all P-levels included #then returns true", () => {
        expect(
          shouldBlock(findings, ["P-1", "P-2", "P-3", "P-4"]),
        ).toBe(true);
      });
    });

    describe("formatBlockMessage", () => {
      it("#then includes finding count", () => {
        const msg = formatBlockMessage(findings);
        expect(msg).toContain("found 2 issues at blocking P-levels");
      });

      it("#then includes each finding summary", () => {
        const msg = formatBlockMessage(findings);
        expect(msg).toContain(
          "P-1 Finding #1: Null pointer dereference on auth token refresh",
        );
        expect(msg).toContain(
          "P-3 Finding #2: Race condition in cache eviction",
        );
      });

      it("#then includes locations", () => {
        const msg = formatBlockMessage(findings);
        expect(msg).toContain("Location: src/auth/token-manager.ts:67");
        expect(msg).toContain("Location: src/cache/manager.ts:142-158");
      });

      it("#then includes bypass hint", () => {
        const msg = formatBlockMessage(findings);
        expect(msg).toContain("git commit --no-verify");
      });

      it("#when single finding #then uses singular 'issue'", () => {
        const msg = formatBlockMessage([findings[0]]);
        expect(msg).toContain("found 1 issue at blocking P-levels");
      });
    });

    describe("filterByConfidence", () => {
      it("#when threshold is 'high' #then keeps both findings", () => {
        const filtered = filterByConfidence(findings, "high");
        expect(filtered).toHaveLength(2);
      });

      it("#when threshold is 'certain' #then keeps only P-1", () => {
        const filtered = filterByConfidence(findings, "certain");
        expect(filtered).toHaveLength(1);
        expect(filtered[0].priority).toBe("P-1");
      });

      it("#when threshold is 'medium' #then keeps both", () => {
        const filtered = filterByConfidence(findings, "medium");
        expect(filtered).toHaveLength(2);
      });

      it("#when threshold is 'low' #then keeps all", () => {
        const filtered = filterByConfidence(findings, "low");
        expect(filtered).toHaveLength(2);
      });
    });
  });

  describe("#given edge cases", () => {
    describe("parseArgusFindings", () => {
      it("#when input is empty string #then returns empty array", () => {
        expect(parseArgusFindings("")).toEqual([]);
      });

      it("#when input is whitespace only #then returns empty array", () => {
        expect(parseArgusFindings("   \n\n  ")).toEqual([]);
      });

      it("#when input has no findings #then returns empty array", () => {
        expect(
          parseArgusFindings("# Some Report\n\nNo issues found."),
        ).toEqual([]);
      });

      it("#when finding is missing metrics #then skips it gracefully", () => {
        const malformed = `## Finding #1: Bad finding

**Priority**: P-1 (BLOCKER)

**Metrics**:

**Location**: \`foo.ts:1\`

**Issue**: Something is wrong.`;
        const results = parseArgusFindings(malformed);
        expect(results).toHaveLength(1);
        expect(results[0].impact).toBe("");
      });

      it("#when finding is missing priority #then skips it", () => {
        const noPriority = `## Finding #1: No priority here

**Metrics**:
- Impact: CRITICAL

**Issue**: Missing priority line.`;
        expect(parseArgusFindings(noPriority)).toEqual([]);
      });

      it("#when metrics use hyphens instead of em dashes #then still parses", () => {
        const hyphenMetrics = `## Finding #1: Hyphen test

**Priority**: P-2 (HIGH)

**Metrics**:
- Impact: CRITICAL - some description
- Trigger: COMMON - happens often
- Blast Radius: SYSTEM-WIDE - everywhere
- Fix Effort: COMPLEX - takes time
- Confidence: MEDIUM - not sure

**Location**: \`test.ts:1\`

**Issue**: Test issue.`;
        const results = parseArgusFindings(hyphenMetrics);
        expect(results).toHaveLength(1);
        expect(results[0].impact).toBe("CRITICAL");
        expect(results[0].confidence).toBe("medium");
      });

      it("#when metrics lack emoji prefixes #then still parses", () => {
        const noEmoji = `## Finding #1: No emoji

**Priority**: P-4 (LOW)

**Metrics**:
- Impact: LOW — minor
- Trigger: NEVER-IN-PRACTICE — theoretical
- Blast Radius: LOCAL — single function
- Fix Effort: TRIVIAL — one line
- Confidence: LOW — uncertain

**Location**: \`x.ts:5\`

**Issue**: Minor thing.`;
        const results = parseArgusFindings(noEmoji);
        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
          priority: "P-4",
          priorityLabel: "LOW",
          impact: "LOW",
          trigger: "NEVER-IN-PRACTICE",
          blastRadius: "LOCAL",
          fixEffort: "TRIVIAL",
          confidence: "low",
        });
      });
    });

    describe("shouldBlock", () => {
      it("#when findings is empty #then returns false", () => {
        expect(shouldBlock([], ["P-1"])).toBe(false);
      });
    });

    describe("formatBlockMessage", () => {
      it("#when findings is empty #then still produces valid message", () => {
        const msg = formatBlockMessage([]);
        expect(msg).toContain("found 0 issues");
      });
    });

    describe("filterByConfidence", () => {
      it("#when findings is empty #then returns empty array", () => {
        expect(filterByConfidence([], "low")).toEqual([]);
      });
    });
  });
});
