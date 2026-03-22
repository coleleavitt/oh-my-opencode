export const REVIEW_TEMPLATE = `# Code Review Command

You are invoking the cubic-reviewer agent to perform a structured P0-P3 code review.

## Instructions

1. **Determine review mode** from the user's arguments:
   - No arguments or "uncommitted" → Review all uncommitted changes (staged + unstaged)
   - \`--commit <hash>\` or \`-c <hash>\` → Review a specific commit (default: HEAD)
   - \`--base <branch>\` or \`-b <branch>\` → PR-style review comparing current branch to base (default: main)
   - \`--security\` or \`-s\` → Security-focused vulnerability audit
   - Any other text → Custom review with those instructions

2. **Delegate to cubic-reviewer** using the task tool:

\`\`\`
task(subagent_type="cubic-reviewer", run_in_background=false, description="Review code changes", prompt="<review prompt based on mode>")
\`\`\`

3. **Parse the review output** and present a summary:
   - Count issues by priority (P0, P1, P2, P3)
   - List all P0 and P1 issues prominently
   - If zero P0 and P1: report "Review clean — ready to commit"
   - If P0 or P1 found: report "Review found N critical/high issues that should be fixed"

4. **If the user provided --fix flag**: After the review, automatically fix all P0 and P1 issues, then re-review to confirm fixes are clean. Repeat until zero P0/P1.

## Review Prompt Templates

### Uncommitted Changes
Prompt: "Review all uncommitted changes (staged + unstaged) for P0-P3 issues. Run \`git status --porcelain\`, \`git diff\`, and \`git diff --cached\` in parallel first. Focus on bugs INTRODUCED by recent changes."

### Specific Commit
Prompt: "Review commit {hash} for P0-P3 issues. Run \`git show {hash} --stat\` and \`git show {hash}\` first. Check commit quality (atomic? clear message?) and all changed files."

### Base Branch Comparison
Prompt: "Review all changes between current branch and {branch} for P0-P3 issues (PR-style review). Run \`git diff origin/{branch} --stat\` and \`git diff origin/{branch}\` first. Focus on issues INTRODUCED by this branch."

### Security Audit
Prompt: "Perform a security audit of the codebase. Search for hardcoded secrets, injection vulnerabilities, auth bypass, command execution, eval/dynamic code, deserialization, and crypto issues. Report CONFIRMED vulnerabilities only."

### Custom Review
Prompt: "Review code with these custom instructions: {instructions}. Focus on real bugs and security issues, not style preferences."

IMPORTANT: The review runs in READ-ONLY mode. The cubic-reviewer agent cannot modify files. If --fix is specified, YOU do the fixing after receiving the review results.`

export const REVIEW_LOOP_TEMPLATE = `# Review Loop Command

Run the implement→review→fix→re-review loop until the codebase is clean.

## Process

1. **Delegate review** to cubic-reviewer:
   \`task(subagent_type="cubic-reviewer", run_in_background=false, description="Review changes", prompt="Review all uncommitted changes for P0-P3 issues. Focus on bugs introduced by recent edits.")\`

2. **Parse findings** from the review output:
   - Extract all **[P0]**, **[P1]**, **[P2]**, **[P3]** issues
   - Count by priority

3. **If P0 or P1 issues exist**:
   - Fix ALL P0 issues (critical — must fix)
   - Fix ALL P1 issues (high — should fix)
   - Fix P2 issues if straightforward
   - Note P3 issues but skip them

4. **Re-review** after fixes:
   - Delegate to cubic-reviewer again
   - Verify fixes are clean and didn't introduce new issues

5. **Repeat** steps 2-4 until:
   - Zero P0 and P1 findings remain
   - Maximum 5 review cycles (safety limit)

6. **Report final status**:
   - "Review loop complete: N cycles, zero P0/P1 remaining"
   - Or: "Review loop hit max cycles: N P0/P1 issues remain"

## Important Rules
- Track each review cycle with TodoWrite
- After each fix, verify the fix didn't break anything (run relevant tests if available)
- NEVER delete tests to make them pass
- NEVER add type ignores to suppress errors
- If you cannot fix a P0/P1 after 2 attempts, flag it for the user and move on`
