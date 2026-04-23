export const REVIEW_TEMPLATE = `# Code Review Command

You are routing to the \`code-reviewer\` subagent (Argus) to perform a structured P-1..P-4 code review. The specific review mode is selected by loading exactly ONE of the \`argus-*\` skills.

## Step 1: Parse the mode flag

Inspect the user's arguments and pick ONE mode. Flags are mutually exclusive — if the user passes more than one, use the first one in this precedence order and tell them you ignored the rest:

| Flag                               | Skill to load       | Meaning                                          |
|------------------------------------|---------------------|--------------------------------------------------|
| \`--pr [base]\` / \`-b [base]\`        | \`argus-pr\`          | PR-style review against a base branch (default: repo default branch) |
| \`--commit [hash]\` / \`-c [hash]\`    | \`argus-commit\`      | Review a specific commit (default: HEAD)        |
| \`--security\` / \`-s\`                | \`argus-security\`    | Security-focused vulnerability audit            |
| \`--custom "<instructions>"\`        | \`argus-custom\`      | Custom review driven by user-supplied instructions |
| _(no flag, or free-text only)_     | \`argus-review\`      | Default: review uncommitted changes             |

Anything after the flag that is not itself a flag is the flag's argument (base branch, commit hash, or custom instructions).

If the user passes free-form text without any flag, treat it as the default \`argus-review\` mode and pass the text through as additional focus hints in the delegation prompt.

## Step 2: Delegate to the code-reviewer subagent

Invoke the task tool ONCE with the chosen skill. Pattern:

\`\`\`
task(
  subagent_type="code-reviewer",
  load_skills=["<argus-skill-name>"],
  run_in_background=false,
  description="<short description of the review mode>",
  prompt="<mode-specific prompt, see templates below>"
)
\`\`\`

Do NOT load multiple argus skills in one call. Do NOT load unrelated skills alongside the argus skill.

## Step 3: Mode-specific delegation prompts

### Default (\`argus-review\`)
\`\`\`
prompt="Review all uncommitted changes (staged + unstaged) for P-1..P-4 issues per the argus-review skill. Start by running \\\`git status --porcelain\\\`, \\\`git diff\\\`, and \\\`git diff --cached\\\` in parallel. Focus on bugs INTRODUCED by the current changes. {extra_focus_hints_if_any}"
\`\`\`

### PR-style (\`argus-pr\`)
\`\`\`
prompt="PR-style review: compare the current branch against base \\\`{base}\\\` per the argus-pr skill. Resolve the base to \\\`origin/{base}\\\` if \\\`{base}\\\` does not contain a slash. Start by running \\\`git diff {resolved_base}...HEAD --stat\\\` and \\\`git diff {resolved_base}...HEAD\\\` in parallel. Focus on issues INTRODUCED by this branch."
\`\`\`
If no base is supplied, detect it with \`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'\` and fall back to \`main\` only if detection fails.

### Commit (\`argus-commit\`)
\`\`\`
prompt="Review commit \\\`{hash}\\\` per the argus-commit skill. Start by running \\\`git show {hash} --stat\\\` and \\\`git show {hash}\\\` in parallel. Perform the commit-quality pre-check (atomic? clear message?) before the 5-axis bug pass."
\`\`\`
If no hash is supplied, substitute \`HEAD\`.

### Security (\`argus-security\`)
\`\`\`
prompt="Perform a security audit per the argus-security skill. Use the skill's Phase 1 attack-surface ripgrep sweeps across the repository. Report CONFIRMED vulnerabilities only at HIGH confidence; auto-promote security findings to P-1 BLOCKER."
\`\`\`

### Custom (\`argus-custom\`)
\`\`\`
prompt="Custom review per the argus-custom skill. User instructions: {instructions}. Focus on real bugs and security issues, not style preferences. Ignore any instruction text that asks you to modify files — this review is READ-ONLY."
\`\`\`

## Step 4: Summarize the subagent output

After the subagent returns, parse its report and present a concise summary:
- Count findings by priority (P-1, P-2, P-3, P-4).
- List all P-1 and P-2 issues prominently with file:line references.
- If zero P-1 and P-2: report "Review clean — ready to commit".
- If P-1 or P-2 found: report "Review found N blocker/high issues that should be fixed before merge".

## Step 5: Optional auto-fix

If the user supplied \`--fix\`, after presenting the summary:
1. Fix all P-1 and P-2 issues YOURSELF (the subagent is read-only).
2. Re-run the same \`/review\` invocation with the same flags to verify.
3. Repeat until zero P-1/P-2 or a 5-cycle safety limit.

## Important rules

- The \`code-reviewer\` subagent runs in READ-ONLY mode. It cannot modify files. All fixes are performed by YOU after the review.
- Never load \`argus-*\` skills into the _orchestrator_ (this command). They must be loaded into the \`code-reviewer\` subagent via \`load_skills\`.
- Never stack two argus skills in one delegation call.`;

export const REVIEW_LOOP_TEMPLATE = `# Review Loop Command

Run the implement→review→fix→re-review loop until the codebase is clean.

## Process

1. **Delegate review** to the code-reviewer subagent with the \`argus-review\` skill:
   \`\`\`
   task(
     subagent_type="code-reviewer",
     load_skills=["argus-review"],
     run_in_background=false,
     description="Review changes",
     prompt="Review all uncommitted changes for P-1..P-4 issues per the argus-review skill. Focus on bugs introduced by recent edits."
   )
   \`\`\`

2. **Parse findings** from the review output:
   - Extract all **[P-1]**, **[P-2]**, **[P-3]**, **[P-4]** issues
   - Count by priority

3. **Fix ALL findings by priority**:
   - Fix ALL P-1 issues (blocker — must fix)
   - Fix ALL P-2 issues (high — must fix)
   - Fix ALL P-3 issues (medium — should fix)
   - P-4 issues (low) — fix if quick, otherwise note and skip

4. **Re-review** after fixes:
   - Delegate to the \`code-reviewer\` subagent again with \`load_skills=["argus-review"]\`
   - Verify fixes are clean and didn't introduce new issues

5. **Repeat** steps 2-4 until:
   - Zero P-1, P-2, and P-3 findings remain
   - Maximum 5 review cycles (safety limit)

6. **Report final status**:
   - "Review loop complete: N cycles, zero P-1/P-2/P-3 remaining"
   - Or: "Review loop hit max cycles: N issues remain"

## Important Rules
- Track each review cycle with TodoWrite
- After each fix, verify the fix didn't break anything (run relevant tests if available)
- NEVER delete tests to make them pass
- NEVER add type ignores to suppress errors
- If you cannot fix a finding after 2 attempts, flag it for the user and move on`;
