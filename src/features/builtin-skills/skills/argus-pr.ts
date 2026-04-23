import type { BuiltinSkill } from "../types";

export const argusPrSkill: BuiltinSkill = {
  name: "argus-pr",
  description:
    "Argus PR-style review comparing current branch to a base branch (default: main). Produces 5-axis findings per file changed. MUST USE for pre-merge code review. Triggers: 'argus pr review', 'review my branch', 'pr review', 'compare to main', 'review against base'.",
  agent: "code-reviewer",
  argumentHint: "<base-branch> (default: main)",
  template: `# Argus Code Review — PR Branch Comparison

You are invoking the Argus code reviewer to compare the current branch against a base branch (PR-style review).

Base branch: {ARG | "main"} (use first argument, default to "main")

## Step 1: Gather Branch Diff (run in parallel via Bash)
1. \`git rev-parse --abbrev-ref HEAD\` — get current branch name
2. \`git diff origin/{base} --stat\` — file change overview
3. \`git diff origin/{base}\` — full diff
4. \`git log origin/{base}..HEAD --oneline\` — commits on this branch

If the base branch lacks "origin/" prefix, prepend it; if it already has a "/", use as-is.

## Step 2: Delegate to Argus Subagent

\`\`\`
task(
  subagent_type="code-reviewer",
  description="Argus PR-style review against {base}",
  prompt="Review this branch's changes against {base} using the 5-axis taxonomy and P-tier derivation defined in your system prompt. \\n\\n[paste git diff stat output] \\n\\n[paste full git diff output] \\n\\n[paste commit list]"
)
\`\`\`

## Step 3: Present Findings + PR Recommendation

After Argus returns findings, present a Summary section AT THE END:

\`\`\`
## PR Review Summary
- **P-1 Blocker**: {count}
- **P-2 High**: {count}
- **P-3 Medium**: {count}
- **P-4 Low**: {count}

**Recommendation**: {APPROVE / REQUEST CHANGES / NEEDS DISCUSSION}
\`\`\`

Recommendation logic:
- ANY P-1 → REQUEST CHANGES
- 3+ P-2 → REQUEST CHANGES
- 1-2 P-2 → NEEDS DISCUSSION
- Only P-3/P-4 → APPROVE with notes

## Critical Constraints

- DO NOT skip the code-reviewer subagent delegation
- DO NOT modify files
- DO NOT push, merge, or alter git state`,
};
