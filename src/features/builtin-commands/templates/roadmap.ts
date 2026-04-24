export const ROADMAP_TEMPLATE = `Generate or update a \`ROADMAP.md\` at the repository root in the phased, stable-decimal-ID format documented below. The format's defining property is that IDs (\`1\`, \`1.5\`, \`2\`, \`3\`, \`3.5\`, \`4\`, \`4.5\`, \`4.6\`, \`4.7\`, ...) let you insert items between existing ones without renumbering downstream items. Every item that ships keeps the ID it was filed under.

## ARGUMENTS

- \`/roadmap [project-name]\`
  - \`project-name\` (optional): title line. Infer from the repo if omitted.
- Pass intent inline: \`/roadmap focus=agent-hooks\` or \`/roadmap update-only\` to re-evaluate existing items without adding new ones.

## WHAT TO DO

1. **Read the current ROADMAP.md if it exists** — DO NOT renumber existing items. That's the whole point of decimal IDs. New items get inserted at \`{N}.5\`, \`{N}.6\`, etc., in the right phase.

2. **Investigate current state** before adding items — every new roadmap item must be anchored to real observed friction in the codebase, not speculation.
   - Read recent git log: \`git log --oneline -30\`
   - Read issue tracker / TODO grep: \`grep -rn "TODO\\|FIXME\\|HACK" --include='*.ts' --include='*.tsx' src/\` (adapt language)
   - Read existing docs for stated goals: AGENTS.md, CLAUDE.md, PARITY.md, README.md
   - Identify patterns from recent bug reports or session transcripts if you have them

3. **Write ROADMAP.md with this EXACT structure:**

   \`\`\`markdown
   # {Project} Roadmap

   ## Goal

   Turn {project} into the most **{defining-property}** {system-type}:
   - no {anti-pattern 1}
   - no {anti-pattern 2}
   - no {anti-pattern 3}
   - no {anti-pattern 4}
   - no {anti-pattern 5}

   This roadmap assumes the primary users are **{describe the non-human or non-default user model}**.

   ## Definition of "{defining-property}"

   A {defining-property} {system-type} is:
   - {property}
   - {property}
   - {property}
   - {property}
   - {property}
   - {property}
   - {property}

   ## Current Pain Points

   ### 1. {Pain point title}
   - {specific observed failure mode}
   - {another observed failure}
   - {third}

   ### 2. {Pain point title}
   - {observed failure}
   - ...

   {Continue numbering 1, 2, 3, ... — whole numbers only for pain points.}

   ## Product Principles

   - **{Principle 1 short name}**: {one-line definition}
   - **{Principle 2}**: {definition}
   - **{Principle 3}**: {definition}
   - **{Principle 4}**: {definition}

   {Keep principles to 4-8 items. They must be testable predicates you can point at an implementation and answer yes/no.}

   ## Roadmap

   ## Phase 1 — {Phase title}

   ### 1. {Item title}

   **Problem**: {one paragraph of observed failure, with file path or session transcript citation}

   **Proposed**: {one paragraph of solution shape, not implementation detail}

   **Acceptance**: {one paragraph of what "done" looks like — a specific observable outcome, not "works correctly"}

   **Status**: {unstarted / in-progress / implemented / wont-fix / superseded-by-N.M}

   ### 1.5. {Item title inserted later}

   {Same structure. Use decimal IDs to slot items in without renumbering.}

   ### 2. {Next item}

   ...

   ## Phase 2 — {Next phase title}

   ### 3. {Item title}

   ...

   ### 3.5. {Inserted later}

   ...

   ### 4. {Item title}

   **Problem**: ...
   **Proposed**: ...
   **Acceptance**: ...
   **Status**: ...

   ### 4.5. {Inserted later}
   ### 4.6. {Inserted later}
   ### 4.7. {Inserted later}

   ...
   \`\`\`

## STYLE RULES (non-negotiable)

1. **Decimal IDs are STABLE FOREVER.** Once \`4.7\` is filed, it never becomes \`4.8\` or \`5\`. Items get renumbered only when promoted to a later phase AND you explicitly mark \`superseded-by-N.M\` on the original.

2. **New items between existing ones use \`.5\`, \`.6\`, \`.7\`, etc.** If you need to insert between \`4.5\` and \`4.6\`, use \`4.55\`. Never renumber downstream.

3. **Every item has all four fields: Problem, Proposed, Acceptance, Status.** A missing field is a sign the item wasn't thought through. Don't add it yet.

4. **Problem cites concrete evidence** — file path, line, session transcript quote, or bug report ID. No hypothetical "users might want X."

5. **Acceptance is testable** — "subagent sessions remain navigable 30s after completion" not "better UX for subagents."

6. **Status values are exactly one of**: \`unstarted\`, \`in-progress\`, \`implemented\`, \`wont-fix\`, \`superseded-by-{id}\`. No freeform status.

7. **Pain points use whole numbers**, roadmap items use decimals. They're different namespaces.

8. **Phases are large groupings** — don't add a phase per feature. Each phase represents a coherent capability the system will have after completion.

## HOW TO INSERT A NEW ITEM

- Find the phase it belongs to.
- Find the two items it sits between (say \`4\` and \`4.5\`).
- Use the next unused decimal (\`4.25\` in that case).
- Fill in all four fields.
- Keep the item as \`unstarted\` until work actually begins.

## HOW TO UPDATE AN EXISTING ITEM

- Change the Status field to reflect current reality.
- If superseded: set \`Status: superseded-by-N.M\` and create a new item at a new ID. DO NOT edit the original's Problem/Proposed/Acceptance — those are historical record.
- If newly implemented: set Status to \`implemented\` and optionally add a short "Shipped in: {commit-sha}" line below Status. Don't remove the item — the roadmap is a history of decisions, not a TODO list.

## DO NOT

- Renumber items. Ever.
- File items without real observed Problem citations.
- Collapse multiple items into one because they feel related — that destroys the addressability of decimal IDs.
- Remove implemented items to keep the roadmap short — the history IS the value.
- Write Acceptance criteria that require a human to judge — if it's not testable, it's not acceptance.

## IF THE REPO HAS NO EXISTING ROADMAP.md

Write one with 2-3 phases, 5-10 items. Derive Problem citations from what you actually see in the codebase. Mark everything \`unstarted\`. Next iteration fills in.

## IF ROADMAP.md ALREADY EXISTS

Read it end-to-end before touching anything. Update Status fields for items whose reality has changed. Insert new items at decimal IDs only. Never renumber. Promote items from \`unstarted\` → \`in-progress\` → \`implemented\` based on observed git history.
`
