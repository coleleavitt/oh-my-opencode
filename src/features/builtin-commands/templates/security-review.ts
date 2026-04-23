export const SECURITY_REVIEW_TEMPLATE = `# Security Review Command

You are routing to the \`code-reviewer\` subagent (Argus) to perform a security-focused vulnerability audit. This command always loads the \`argus-security\` skill.

## Step 1: Determine scope

Inspect the user's arguments to determine the audit scope:

| Argument                          | Scope                                                        |
|-----------------------------------|--------------------------------------------------------------|
| \`--branch [base]\` / \`-b [base]\`  | Security audit of branch diff against base (default: repo default branch) |
| \`--commit [hash]\` / \`-c [hash]\`  | Security audit of a specific commit (default: HEAD)          |
| _(no argument or free-text)_      | Full repository security audit (default)                     |

Free-text arguments are passed as additional focus hints (e.g., "focus on auth endpoints").

## Step 2: Delegate to the code-reviewer subagent

Invoke the task tool ONCE with the \`argus-security\` skill:

\`\`\`
task(
  subagent_type="code-reviewer",
  load_skills=["argus-security"],
  run_in_background=false,
  description="Security audit",
  prompt="<scope-specific prompt, see templates below>"
)
\`\`\`

## Step 3: Scope-specific delegation prompts

### Full repository (default)
\`\`\`
prompt="Perform a security audit per the argus-security skill. Use the skill's Phase 1 attack-surface ripgrep sweeps across the repository. Report CONFIRMED vulnerabilities only at HIGH confidence; auto-promote security findings to P-1 BLOCKER. {extra_focus_hints_if_any}"
\`\`\`

### Branch diff (\`--branch\`)
\`\`\`
prompt="Perform a security audit per the argus-security skill, scoped to the branch diff against \\\`{base}\\\`. Start by running \\\`git diff {resolved_base}...HEAD\\\` to identify changed files, then apply the skill's Phase 1 attack-surface sweeps to those files and their immediate dependencies. Report CONFIRMED vulnerabilities only at HIGH confidence; auto-promote security findings to P-1 BLOCKER."
\`\`\`
If no base is supplied, detect it with \`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'\` and fall back to \`main\` only if detection fails.

### Commit (\`--commit\`)
\`\`\`
prompt="Perform a security audit per the argus-security skill, scoped to commit \\\`{hash}\\\`. Start by running \\\`git show {hash} --stat\\\` and \\\`git show {hash}\\\` in parallel to identify changed files, then apply the skill's Phase 1 attack-surface sweeps to those files. Report CONFIRMED vulnerabilities only at HIGH confidence; auto-promote security findings to P-1 BLOCKER."
\`\`\`
If no hash is supplied, substitute \`HEAD\`.

## Step 4: Summarize the subagent output

After the subagent returns, parse its report and present a concise summary:
- Count findings by priority (P-1, P-2, P-3, P-4).
- List all P-1 and P-2 issues prominently with file:line references and vulnerability type (e.g., XSS, SQLi, SSRF).
- If zero P-1 and P-2: report "Security audit clean — no high-severity vulnerabilities found".
- If P-1 or P-2 found: report "Security audit found N blocker/high vulnerabilities that must be fixed".

## Step 5: Optional auto-fix

If the user supplied \`--fix\`, after presenting the summary:
1. Fix all P-1 and P-2 security issues YOURSELF (the subagent is read-only).
2. Re-run the same \`/security-review\` invocation with the same scope to verify.
3. Repeat until zero P-1/P-2 or a 5-cycle safety limit.

## Important rules

- The \`code-reviewer\` subagent runs in READ-ONLY mode. It cannot modify files. All fixes are performed by YOU after the review.
- Always load \`argus-security\` — never load other argus skills from this command.
- Never stack two argus skills in one delegation call.`;
