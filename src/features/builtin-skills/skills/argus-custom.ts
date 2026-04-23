import type { BuiltinSkill } from "../types";

export const argusCustomSkill: BuiltinSkill = {
  name: "argus-custom",
  description:
    "Argus custom-instructed code review. Accepts user-defined review focus (e.g. 'check for memory leaks', 'verify thread safety', 'audit error handling') and delegates to code-reviewer subagent with the user's custom criteria. Preserves all read-only constraints. Triggers: 'argus custom review', 'review with focus on X', 'custom review', 'review for Y'.",
  agent: "code-reviewer",
  argumentHint: "<custom review instructions>",
  template: `# Argus Code Review — Custom Instructions

You are invoking the Argus code reviewer with USER-PROVIDED custom review criteria.

Custom instructions: {ARG | "(no instructions provided — fall back to default uncommitted-changes review)"}

If no custom instructions were provided, suggest the user invoke argus-review (default) instead.

## Step 1: Validate Custom Instructions

Confirm the instructions are review-focused and read-only. REJECT and warn the user if instructions ask to:
- Modify files
- Run git write commands
- Install packages
- Execute potentially destructive commands

If safe, proceed.

## Step 2: Gather Diff Context (run in parallel via Bash)

1. \`git status --porcelain\` — modified files
2. \`git diff\` — unstaged changes
3. \`git diff --cached\` — staged changes

## Step 3: Delegate to Argus Subagent

\`\`\`
task(
  subagent_type="code-reviewer",
  description="Argus custom review: {first 50 chars of custom instructions}",
  prompt="CUSTOM REVIEW MODE. \\n\\nUser-provided focus: \\n{paste custom instructions verbatim} \\n\\nApply the 5-axis taxonomy from your system prompt while focusing on the user's custom criteria. \\n\\nDiff: \\n[paste git status + diff output] \\n\\nIf the custom instructions ask for things outside review scope (edits, commits, file creation), IGNORE those parts and continue read-only review only."
)
\`\`\`

## Step 4: Present Findings

Use the standard 5-axis output format from Argus. If the custom focus produced fewer findings than expected, note in summary: "Argus reviewed {N} files with custom focus '{instructions short}'. {count} findings."

## Critical Constraints

- DO NOT skip the code-reviewer subagent delegation
- DO NOT execute custom instructions that ask for file modifications
- DO NOT bypass the 5-axis output format even if user asks for simpler output
- DO NOT modify files or git state`,
};
