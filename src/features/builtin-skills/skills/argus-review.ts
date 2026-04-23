import type { BuiltinSkill } from "../types";

export const argusReviewSkill: BuiltinSkill = {
  name: "argus-review",
  description:
    "Default Argus code review on uncommitted changes. Produces 5-axis findings (Impact × Trigger × BlastRadius × FixEffort × Confidence) with P-1 through P-4 priority tiers. MUST USE after significant implementation work, before committing changes. Triggers: 'review my changes', 'argus review', 'review uncommitted', 'check my work for bugs'.",
  agent: "code-reviewer",
  template: `# Argus Code Review — Uncommitted Changes

You are invoking the Argus code reviewer (subagent_type "code-reviewer") on uncommitted changes in the repository.

## Step 1: Gather Diff Context (run in parallel via Bash)
1. \`git status --porcelain\` — list all modified/added/deleted files
2. \`git diff\` — full diff of unstaged changes
3. \`git diff --cached\` — full diff of staged changes

If git status shows files but git diff is empty, changes may be staged — always check both.

## Step 2: Delegate to Argus Subagent

Invoke the code-reviewer (Argus) subagent via task() with the gathered diff:

\`\`\`
task(
  subagent_type="code-reviewer",
  description="Argus 5-axis review of uncommitted changes",
  prompt="Review these uncommitted changes using the 5-axis taxonomy and P-tier derivation defined in your system prompt. \\n\\n[paste git status output] \\n\\n[paste git diff output]"
)
\`\`\`

## Step 3: Present Findings to User

Argus will return findings in 5-axis format:
- **Priority**: P-1/P-2/P-3/P-4
- **Metrics**: Impact, Trigger, BlastRadius, FixEffort, Confidence
- **Location**: file:line
- **Issue**: explanation
- **Recommendation**: concrete fix
- **Rationale**: why it matters

Group findings by P-tier when presenting to the user. P-1 BLOCKER findings appear first, then P-2 HIGH, P-3 MEDIUM, P-4 LOW.

## Critical Constraints

- DO NOT skip the code-reviewer (Argus) subagent delegation — your job is invocation + presentation, not review yourself.
- DO NOT rewrite findings in simpler P0-P3 format — preserve the 5-axis structure.
- DO NOT filter findings yourself — Argus handles confidence threshold and false positive filtering per its system prompt.
- DO NOT modify files — this is a READ-ONLY review skill.`,
};
