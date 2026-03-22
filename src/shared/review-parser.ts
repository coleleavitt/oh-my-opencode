/**
 * Structured output parser for cubic-reviewer P0-P3 review findings.
 * Extracts issues from the reviewer's markdown output into structured objects.
 *
 * Based on the Cubic CLI's parseReviewResponse() logic.
 */

export interface ReviewIssue {
  priority: 0 | 1 | 2 | 3
  file: string
  line: number | null
  title: string
  description: string
}

export interface ReviewResult {
  issues: ReviewIssue[]
  counts: { p0: number; p1: number; p2: number; p3: number }
  hasBlockers: boolean
  summary: string
}

/**
 * Parse the cubic-reviewer's markdown output into structured ReviewIssue objects.
 *
 * Matches two formats:
 * - With line number: **[P0] src/foo.ts:42 - Title here**
 * - Without line number: **[P0] src/foo.ts - Title here**
 */
export function parseReviewResponse(text: string): ReviewResult {
  const issues: ReviewIssue[] = []

  // Pattern with line number: **[P0] file:line - title**
  const withLine = /\*\*\[P([0-3])]\s+([^:\s]+):(\d+)\s*[-—]\s*(.+?)\*\*\s*\n+([\s\S]+?)(?=\*\*\[P|$)/g
  // Pattern without line number: **[P0] file - title**
  const withoutLine = /\*\*\[P([0-3])]\s+([^:\s]+)\s+[-—]\s*(.+?)\*\*\s*\n+([\s\S]+?)(?=\*\*\[P|$)/g

  const seen = new Set<string>()

  for (const match of text.matchAll(withLine)) {
    const key = `${match[2]}:${match[3]}:${match[4]}`
    if (seen.has(key)) continue
    seen.add(key)

    issues.push({
      priority: parseInt(match[1], 10) as 0 | 1 | 2 | 3,
      file: match[2],
      line: parseInt(match[3], 10),
      title: match[4].trim(),
      description: match[5].trim(),
    })
  }

  for (const match of text.matchAll(withoutLine)) {
    const key = `${match[2]}::${match[3]}`
    if (seen.has(key)) continue
    seen.add(key)

    issues.push({
      priority: parseInt(match[1], 10) as 0 | 1 | 2 | 3,
      file: match[2],
      line: null,
      title: match[3].trim(),
      description: match[4].trim(),
    })
  }

  // Sort by priority (P0 first)
  issues.sort((a, b) => a.priority - b.priority)

  const counts = {
    p0: issues.filter(i => i.priority === 0).length,
    p1: issues.filter(i => i.priority === 1).length,
    p2: issues.filter(i => i.priority === 2).length,
    p3: issues.filter(i => i.priority === 3).length,
  }

  const hasBlockers = counts.p0 > 0 || counts.p1 > 0

  const parts: string[] = []
  if (counts.p0 > 0) parts.push(`${counts.p0} P0 critical`)
  if (counts.p1 > 0) parts.push(`${counts.p1} P1 high`)
  if (counts.p2 > 0) parts.push(`${counts.p2} P2 medium`)
  if (counts.p3 > 0) parts.push(`${counts.p3} P3 low`)

  const summary = parts.length > 0
    ? `Found ${issues.length} issues: ${parts.join(", ")}`
    : "No issues found — review clean"

  return { issues, counts, hasBlockers, summary }
}

/**
 * Format a ReviewResult into a concise summary string suitable for
 * injection into agent prompts or notification messages.
 */
export function formatReviewSummary(result: ReviewResult): string {
  if (!result.hasBlockers && result.issues.length === 0) {
    return "Review clean — zero issues found. Ready to commit."
  }

  const lines: string[] = [result.summary, ""]

  if (result.hasBlockers) {
    lines.push("Issues requiring fixes:")
    for (const issue of result.issues) {
      if (issue.priority > 1) continue
      const loc = issue.line ? `${issue.file}:${issue.line}` : issue.file
      lines.push(`  [P${issue.priority}] ${loc} — ${issue.title}`)
    }
  }

  return lines.join("\n")
}
