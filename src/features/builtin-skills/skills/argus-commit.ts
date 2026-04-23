import type { BuiltinSkill } from "../types";

export const argusCommitSkill: BuiltinSkill = {
  name: "argus-commit",
  description:
    "Argus review of a specific commit. Analyzes commit quality (atomicity, message clarity) AND finds bugs in the diff using 5-axis taxonomy. MUST USE for post-hoc commit review or before reverting. Triggers: 'argus commit review', 'review commit <hash>', 'review HEAD', 'review last commit', 'check this commit'.",
  agent: "code-reviewer",
  argumentHint: "<commit-hash> (default: HEAD)",
  template: `# Argus Code Review — Specific Commit

You are invoking the Argus code reviewer on a specific commit.

Commit: {ARG | "HEAD"} (use first argument, default to "HEAD")

## Step 1: Gather Commit Context (run in parallel via Bash)
1. \`git show {commit} --stat\` — files changed
2. \`git show {commit}\` — full diff
3. \`git log -1 {commit} --format='%s%n%n%b'\` — commit message
4. \`git log -1 {commit} --format='Author: %an <%ae>%nDate: %ai'\` — author + date

## Step 2: Quality Pre-Check

Evaluate commit quality before delegating:
- **Message clarity**: Clear and descriptive? Explains WHY, not just WHAT?
- **Atomicity**: Does the commit do ONE thing? Any unrelated changes mixed in?
- **Completeness**: Necessary files included? Tests updated? Docs?

## Step 3: Delegate to Argus Subagent

\`\`\`
task(
  subagent_type="code-reviewer",
  description="Argus review of commit {commit-short}",
  prompt="Review this commit using the 5-axis taxonomy and P-tier derivation defined in your system prompt. \\n\\n[paste commit message] \\n\\n[paste git show output] \\n\\nFocus on issues INTRODUCED by this commit, not pre-existing issues."
)
\`\`\`

## Step 4: Present Combined Report

\`\`\`
## Commit Review: {short-hash}

### Commit Info
- **Message**: {message}
- **Author**: {author}
- **Files**: {count} changed

### Commit Quality
- Message: {GOOD / NEEDS IMPROVEMENT}
- Atomicity: {ATOMIC / MIXED CONCERNS}
- Completeness: {COMPLETE / MISSING PIECES}

### Findings (5-axis)
[Argus findings here, grouped by P-tier]

### Verdict
{GOOD TO GO / NEEDS FIXES / NEEDS DISCUSSION}
\`\`\`

## Critical Constraints

- DO NOT skip the code-reviewer subagent delegation
- DO NOT modify files or git state
- DO NOT amend, revert, or reset commits`,
};
