export const PARITY_TEMPLATE = `Generate or update a \`PARITY.md\` at the repository root in the evidence-driven status-tracking format documented below. The format's purpose is reproducible, verifiable tracking of multi-lane feature work — every claim must cite a commit hash, a file path, or a concrete line-of-code count.

## ARGUMENTS

- \`/parity [project-name]\`
  - \`project-name\` (optional): title line of the doc. If omitted, infer from \`package.json\` / \`Cargo.toml\` / \`pyproject.toml\`.
- Pass additional context inline: \`/parity upstream=opencode-sst branches=jobdori/*\` to scope which branches are lanes.

## WHAT TO DO

1. **Investigate git state first** — don't write until you have facts.
   - \`git log --oneline -1\` → current HEAD
   - \`git rev-list --count HEAD\` → commits on current branch
   - \`git rev-list --count --all\` → commits across all branches
   - \`git log --format="%an" | sort -u | wc -l\` → author count
   - \`git log --format="%ai" | head -1\` and \`tail -1\` → date range
   - \`find . -name "*.ts" -not -path "./node_modules/*" | xargs wc -l\` (adapt language) → tracked LOC
   - \`find . -name "*.test.ts" | xargs wc -l\` → test LOC
   - \`git branch --all\` → lanes (feature branches) to document

2. **Identify lanes** — each merged feature branch that represents a parity checkpoint is a lane. Ask the user if the project has a canonical "N-lane" concept; otherwise infer from merged branches in the last N commits.

3. **Write PARITY.md with this EXACT structure** (fields are not optional — omit a field only if you can prove it's inapplicable):

   \`\`\`markdown
   # Parity Status — {project-name}

   Last updated: {YYYY-MM-DD}

   ## Summary

   - Canonical document: this top-level \`PARITY.md\` is the file consumed by {parity harness or verification script path}.
   - Requested N-lane checkpoint: **All N lanes {merged/pending} on \`{main-branch}\`.**
   - Current \`{main-branch}\` HEAD: \`{short-sha}\` ({one-line summary of HEAD commit}).
   - Repository stats at this checkpoint: **{N} commits on \`{main}\` / {M} across all branches**, **{N} {modules/crates/packages}**, **{N} tracked {language} LOC**, **{N} test LOC**, **{N} authors**, date range **{first} → {last}**.
   - {Parity harness stats if applicable: N scenarios, N captured requests, etc.}

   ## {Harness/phase} — milestone 1

   - [x] {item with path citation}
   - [x] {item}

   ## {Harness/phase} — milestone 2 (expansion)

   - [x] {item}
   - [ ] {item}

   ## N-lane checkpoint

   | Lane | Status | Feature commit | Merge commit | Evidence |
   |---|---|---|---|---|
   | 1. {Lane title} | merged/pending/blocked | \`{short-sha}\` | \`{short-sha}\` | \`{file path}\` (\`+N/-M\`) |

   ## Lane details

   ### Lane N — {Title}

   - **Status:** {merged on \`main\` / branch-only / blocked on X}.
   - **Feature commit:** \`{short-sha}\` — \`{commit subject verbatim}\`
   - **Merge commit:** \`{short-sha}\` — \`{merge commit subject}\`
   - **Evidence:** branch-only diff adds \`{path}\` and {description} (\`+N/-M across K files\`).
   - **{Main-branch reality / Current state}:** {prose paragraph citing specific file paths, LOC counts, and what exists vs what's stubbed}.

   ## Reconciled from the older PARITY checklist

   - [x] {item} — {one-line evidence}
   - [x] {item}

   ## Still open

   - [ ] {item that's genuinely not done}
   - [ ] {item}

   ## Migration Readiness

   - [x] \`PARITY.md\` maintained and honest
   - [x] All N requested lanes documented with commit hashes and current status
   - [ ] CI green on every commit
   - [x] {other readiness items}
   \`\`\`

## STYLE RULES (non-negotiable — the format's usefulness depends on these)

1. **Every lane detail section cites a commit hash for Feature and Merge.** If a lane isn't merged, say "branch-only at \`{sha}\`" — don't leave the field blank.
2. **Every "done" checkbox has concrete evidence** (file path, LOC number, commit, or scripted test name). A checkbox with no evidence is worse than a missing checkbox.
3. **Prose cites \`+N/-M\` diff stats** — get them from \`git diff --stat {merge-base}..{commit}\` or \`git show --stat {commit}\`.
4. **"Still open" items are HONEST.** If something is stubbed, under-implemented, or flaky, put it here. The doc is worthless if "all green" is aspirational instead of true.
5. **LOC counts are real, not approximate** — from \`wc -l\` output.
6. **Dates are ISO-8601** (YYYY-MM-DD).

## DO NOT

- Write a parity doc with checkboxes marked ✓ that aren't backed by evidence.
- Inflate commit counts, LOC, or test coverage numbers.
- Use generic phrases like "significant progress" or "most complete" — the format rejects them. State facts.
- Generate lane detail sections for lanes that don't exist as real branches or commits.

## IF THE REPO HAS NO EXISTING PARITY.md

Create one. Populate what you can verify from git state today. Mark everything else as \`[ ]\` under "Still open" — next iteration fills in.

## IF A PARITY.md ALREADY EXISTS

Read it first. Update the \`Last updated\` date, re-run all git queries, update HEAD + stats + lane statuses. Preserve the lane ordering and evidence unless commits have superseded them. Promote items from "Still open" to the checkpoint table when evidence appears.
`
