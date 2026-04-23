/**
 * Structured output parser for reviewer findings.
 * Supports BOTH the legacy cubic-reviewer P0-P3 format AND the new
 * Argus (code-reviewer) 5-axis P-1/P-2/P-3/P-4 format during the
 * deprecation window.
 *
 * Normalization: P-1/P-2/P-3/P-4 (Argus) map to 0/1/2/3 internally
 * so downstream consumers can continue to reason about a single
 * 0..3 severity scale (0 = most severe, 3 = least).
 */

export interface ReviewIssue {
  priority: 0 | 1 | 2 | 3;
  file: string;
  line: number | null;
  title: string;
  description: string;
}

export interface ReviewResult {
  issues: ReviewIssue[];
  counts: { p0: number; p1: number; p2: number; p3: number };
  hasBlockers: boolean;
  summary: string;
}

/**
 * Normalize an Argus priority tier (1..4) into the internal 0..3 scale.
 * P-1 BLOCKER -> 0, P-2 HIGH -> 1, P-3 MEDIUM -> 2, P-4 LOW -> 3.
 */
function argusTierToPriority(tier: string): 0 | 1 | 2 | 3 {
  const n = parseInt(tier, 10);
  // tier is the numeric part of "P-N" so N is 1..4; subtract 1 to land on 0..3.
  const normalized = Math.max(0, Math.min(3, n - 1));
  return normalized as 0 | 1 | 2 | 3;
}

/**
 * Parse reviewer markdown output into structured ReviewIssue objects.
 *
 * Cubic P0-P3 formats (legacy):
 * - With line number:    **[P0] src/foo.ts:42 - Title here**
 * - Without line number: **[P0] src/foo.ts - Title here**
 *
 * Argus P-1/P-2/P-3/P-4 formats (new):
 * - Inline (custom rules): **[P-2] src/foo.ts:42 - Title here**
 * - Structured heading: `## Finding #N: Title` followed by
 *   `**Priority**: P-1 (BLOCKER)` and `**Location**: \`src/foo.ts:42\``
 */
export function parseReviewResponse(text: string): ReviewResult {
  const issues: ReviewIssue[] = [];

  // Legacy cubic: **[P0] file:line - title**
  const cubicWithLine =
    /\*\*\[P([0-3])]\s+([^:\s]+):(\d+)\s*[-—]\s*(.+?)\*\*\s*\n+([\s\S]+?)(?=\*\*\[P|$)/g;
  // Legacy cubic: **[P0] file - title**
  const cubicWithoutLine =
    /\*\*\[P([0-3])]\s+([^:\s]+)\s+[-—]\s*(.+?)\*\*\s*\n+([\s\S]+?)(?=\*\*\[P|$)/g;
  // Argus inline: **[P-2] file:line - title**
  const argusWithLine =
    /\*\*\[P-([1-4])]\s+([^:\s]+):(\d+)\s*[-—]\s*(.+?)\*\*\s*\n+([\s\S]+?)(?=\*\*\[P|## Finding |$)/g;
  // Argus inline: **[P-2] file - title**
  const argusWithoutLine =
    /\*\*\[P-([1-4])]\s+([^:\s]+)\s+[-—]\s*(.+?)\*\*\s*\n+([\s\S]+?)(?=\*\*\[P|## Finding |$)/g;
  // Argus structured Finding block (header + Priority line + Location line).
  // Captures: 1=title, 2=tier digit, 3=location (file or file:line), 4=body
  const argusFindingBlock =
    /##\s+Finding\s+#?\d+:\s*(.+?)\n+[\s\S]*?\*\*Priority\*\*:\s*P-([1-4])\b[\s\S]*?\*\*Location\*\*:\s*`?([^`\n]+?)`?\s*\n+([\s\S]+?)(?=\n##\s+Finding\s+#?\d+:|\*\*\[P|$)/g;

  const seen = new Set<string>();

  for (const match of text.matchAll(cubicWithLine)) {
    const key = `${match[2]}:${match[3]}:${match[4]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    issues.push({
      priority: parseInt(match[1], 10) as 0 | 1 | 2 | 3,
      file: match[2],
      line: parseInt(match[3], 10),
      title: match[4].trim(),
      description: match[5].trim(),
    });
  }

  for (const match of text.matchAll(cubicWithoutLine)) {
    const key = `${match[2]}::${match[3]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    issues.push({
      priority: parseInt(match[1], 10) as 0 | 1 | 2 | 3,
      file: match[2],
      line: null,
      title: match[3].trim(),
      description: match[4].trim(),
    });
  }

  for (const match of text.matchAll(argusWithLine)) {
    const key = `${match[2]}:${match[3]}:${match[4]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    issues.push({
      priority: argusTierToPriority(match[1]),
      file: match[2],
      line: parseInt(match[3], 10),
      title: match[4].trim(),
      description: match[5].trim(),
    });
  }

  for (const match of text.matchAll(argusWithoutLine)) {
    const key = `${match[2]}::${match[3]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    issues.push({
      priority: argusTierToPriority(match[1]),
      file: match[2],
      line: null,
      title: match[3].trim(),
      description: match[4].trim(),
    });
  }

  for (const match of text.matchAll(argusFindingBlock)) {
    const rawLocation = match[3].trim();
    const locMatch = /^(.+?):(\d+)$/.exec(rawLocation);
    const file = locMatch ? locMatch[1] : rawLocation;
    const line = locMatch ? parseInt(locMatch[2], 10) : null;
    const title = match[1].trim();
    const key =
      line !== null ? `${file}:${line}:${title}` : `${file}::${title}`;
    if (seen.has(key)) continue;
    seen.add(key);

    issues.push({
      priority: argusTierToPriority(match[2]),
      file,
      line,
      title,
      description: match[4].trim(),
    });
  }

  // Sort by priority (most severe first)
  issues.sort((a, b) => a.priority - b.priority);

  const counts = {
    p0: issues.filter((i) => i.priority === 0).length,
    p1: issues.filter((i) => i.priority === 1).length,
    p2: issues.filter((i) => i.priority === 2).length,
    p3: issues.filter((i) => i.priority === 3).length,
  };

  const hasBlockers = counts.p0 > 0 || counts.p1 > 0 || counts.p2 > 0;

  const parts: string[] = [];
  if (counts.p0 > 0) parts.push(`${counts.p0} P0 critical`);
  if (counts.p1 > 0) parts.push(`${counts.p1} P1 high`);
  if (counts.p2 > 0) parts.push(`${counts.p2} P2 medium`);
  if (counts.p3 > 0) parts.push(`${counts.p3} P3 low`);

  const summary =
    parts.length > 0
      ? `Found ${issues.length} issues: ${parts.join(", ")}`
      : "No issues found — review clean";

  return { issues, counts, hasBlockers, summary };
}

/**
 * Format a ReviewResult into a concise summary string suitable for
 * injection into agent prompts or notification messages.
 */
export function formatReviewSummary(result: ReviewResult): string {
  if (!result.hasBlockers && result.issues.length === 0) {
    return "Review clean — zero issues found. Ready to commit.";
  }

  const lines: string[] = [result.summary, ""];

  if (result.hasBlockers) {
    lines.push("Issues requiring fixes:");
    for (const issue of result.issues) {
      if (issue.priority > 2) continue;
      const loc = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      lines.push(`  [P${issue.priority}] ${loc} — ${issue.title}`);
    }
    if (result.counts.p3 > 0) {
      lines.push(
        `  (${result.counts.p3} P3 low-priority issues noted but not blocking)`,
      );
    }
  }

  return lines.join("\n");
}
