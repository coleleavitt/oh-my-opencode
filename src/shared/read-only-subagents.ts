/**
 * Agents that operate in a purely read-only / research / review mode and
 * therefore don't benefit from project-context injection (README.md,
 * AGENTS.md, CLAUDE.md). Ported from the cc119 `omitClaudeMd: true` pattern
 * at cli.2.1.119.aligned.js:204108 (Explore + Plan subagents) which strips
 * CLAUDE.md from their system context to reduce token burn.
 *
 * Keys are the canonical lowercase agent names used by getSessionAgent().
 */

const READ_ONLY_SUBAGENT_KEYS: ReadonlySet<string> = new Set([
  "explore",     // read-only codebase exploration
  "librarian",   // read-only research
  "oracle",      // consultation, read-only
  "argus",       // code review, read-only
  "code-reviewer", // display alias of argus
])

/**
 * True if the agent name corresponds to a subagent that should NOT receive
 * directory-level context injection. Accepts any casing or known display-
 * name variant; caller can pass the raw value from `getSessionAgent(sid)`.
 */
export function isReadOnlySubagent(agentName: string | undefined): boolean {
  if (!agentName) return false
  return READ_ONLY_SUBAGENT_KEYS.has(agentName.trim().toLowerCase())
}
