export const PHILOSOPHY_TEMPLATE = `Generate or update a \`PHILOSOPHY.md\` at the repository root in the narrative-declarative format documented below. The format's purpose is to communicate WHY a project exists and what system-level assumptions it makes — not what it does (that's README), not how it's implemented (that's ARCHITECTURE), not what's next (that's ROADMAP).

## ARGUMENTS

- \`/philosophy [project-name]\`
  - \`project-name\` (optional): appears in the title. Infer from the repo if omitted.
- No flags — a philosophy doc is either written or not. No partial mode.

## WHAT TO DO

1. **Read the repo first** — README.md, AGENTS.md, CLAUDE.md, any existing docs, and skim 5-10 recent commits. A philosophy doc that isn't grounded in what the project actually does is worthless.

2. **Interview the user if the human interface question isn't obvious.** Every philosophy doc answers "what is the primary human interface / mode of interaction?" If the repo doesn't make that obvious, ask. Don't guess.

3. **Write PHILOSOPHY.md with this EXACT structure:**

   \`\`\`markdown
   # {Project Name} Philosophy

   ## Stop Staring at the {Obvious Thing}

   {One short paragraph naming what a casual reader WOULD focus on if they visited the repo — and arguing that's the wrong layer. For Claude-Code-adjacent projects, the obvious thing is usually "the generated files" or "the source tree." Identify what's obvious here, then pivot.}

   {Second paragraph: name the thing that IS worth studying instead — the coordination system, the event model, the interface choice, the constraint being enforced. One or two sentences.}

   {Project Name} is not {what a casual reader thinks it is}. It is {what it actually is}:

   - {claim 1 — concrete and observable},
   - {claim 2},
   - {claim 3},
   - {claim 4},
   - {claim 5 — typically about what humans DON'T do in this system}.

   ## The {Primary} Interface Is {X}

   {One short paragraph identifying the primary interaction surface — and note what it is NOT. For Claw Code it's Discord, not terminals. For a library it might be the typed API, not the docs. For a CLI it might be stdin/stdout, not the help text.}

   The real {primary interaction} is {X}.

   {Second paragraph: a walkthrough of what a user does in that surface. Concrete verbs, no abstractions. "A person can type a sentence from a phone, walk away, sleep, or do something else."}

   That is the philosophy: **{one-sentence encapsulation of the interaction model}.**

   ## The {Structure Term} System

   {Every philosophy doc has ONE structural claim here — "three-part system," "two-layer model," "five-stage pipeline," etc. The number is small (2-5). If you need more, the structure probably isn't the right one.}

   ### 1. {Component Name} (\`{package-or-repo-link}\`)

   [{Component Name}]({URL}) provides the {layer purpose} layer.

   It {does one thing} by:
   - {concrete capability 1}
   - {concrete capability 2}
   - {concrete capability 3}
   - {concrete capability 4}

   This is the layer that {transforms X into Y in one sentence}.

   ### 2. {Component Name}

   [{Component}]({URL}) is the {purpose} {type}.

   It watches / routes / coordinates:
   - {thing}
   - {thing}
   - {thing}
   - {thing}

   Its job is to keep {specific concern} **outside** {specific boundary} so the {other component} can stay focused on {what they should focus on} instead of {what they shouldn't}.

   ### 3. {Component Name}

   [{Component}]({URL}) handles {layer purpose}.

   This is where {specific behaviors} happen across {things}.

   When {specific conflict or coordination challenge}, {Component} provides the structure for that loop to converge instead of collapse.

   ## The Real Bottleneck Changed

   The bottleneck is no longer {obvious resource — typing speed, compute, storage, whatever fits}.

   When {the system enables a step-change capability}, the scarce resource becomes:
   - {scarce thing 1}
   - {scarce thing 2}
   - {scarce thing 3}
   - {scarce thing 4}
   - {scarce thing 5}
   - {scarce thing 6}

   {One-paragraph restatement: a {fast/capable/whatever} {system} does not remove the need for {thing}. It makes clear {thing} even more valuable.}

   ## What {Project} Demonstrates

   {Project} demonstrates that a {category of thing} can be:

   - **{property 1 — often the most counterintuitive}**
   - {property 2}
   - {property 3}
   - {property 4}
   - {property 5 — typically about the coordination layer being visible}

   {Two-line summary:}
   The {tangible artifact} is {evidence}.
   The {intangible thing} is {product lesson}.

   ## What Still Matters

   As {the cheap resource gets cheaper / the capability gets ubiquitous}, the durable differentiators are not {raw output}.

   What still matters:
   - {durable thing 1}
   - {durable thing 2}
   - {durable thing 3}
   - {durable thing 4}
   - {durable thing 5}
   - {durable thing 6}

   In that world, the job of the {human role here} is not to out-{verb} the {system}.
   The job of the {human role} is to {what they uniquely do}.

   ## Short Version

   **{Project} is a {one-sentence definition}.**

   {Two-to-four line summary, each line capable of standing alone:}
   {Role 1 does X.}
   {Role 2 does Y.}
   {Artifact is the Z.}
   {The W is the lesson.}

   ## Related explanation

   For the longer public explanation behind this philosophy, see:

   - {URL 1 — tweet, blog post, or talk that inspired or expanded on this philosophy}
   - {URL 2 — optional secondary reference}
   \`\`\`

## STYLE RULES (non-negotiable)

1. **No marketing language.** "Revolutionary," "powerful," "cutting-edge," "seamless" → delete. The format rejects them. Every sentence claims a concrete fact or a concrete non-fact.

2. **Every bullet ends with a fact or an explicit refusal.** "Provides X" is fine. "Provides a sophisticated X" is not — cut the adjective.

3. **The bottleneck claim must be observably true.** Don't say "the bottleneck is architectural clarity" if the project's actual bottleneck is (for instance) model latency. State the real one.

4. **"The job of the human is..."** — this line has to be non-obvious. If it reads like every other AI-era philosophy doc ("make decisions, use judgment"), rewrite it until it says something specific to THIS project.

5. **Short Version is 4 sentences max.** If it's longer, the rest of the doc hasn't earned its length.

6. **The structural claim has 2-5 components.** Not 1 (trivial), not 6+ (loses coherence).

7. **Cite real URLs in Related explanation.** If there isn't one, say "(to be added)" explicitly — don't fabricate a link.

## DO NOT

- Write a philosophy doc without at least one paragraph about what the project DOESN'T do, or what category it DOESN'T fit.
- Fill in placeholders with generic marketing prose. Either populate them with specific claims or delete the section.
- Skip the "Short Version" — if you can't write it in 4 sentences, the rest is confused.
- Let the structural section turn into a README. "Does X, Y, Z" isn't a philosophy; "treats the X/Y boundary as sacred because..." is.
- Write this for investors or recruiters. Write it for someone forking the repo who wants to know what assumptions come with it.

## IF NO PHILOSOPHY.md EXISTS

Write one. Lead with the hardest claim — "Stop staring at {X}" section has to identify the thing a casual reader would latch onto that isn't actually the point.

## IF PHILOSOPHY.md EXISTS

Read it end-to-end. Update only if:
- A structural claim has materially changed (new component, component retired)
- The "bottleneck changed" section no longer reflects reality
- The "what still matters" list is missing something the project has come to depend on

Keep the narrative voice. Don't mechanically update — this is the one doc that's NOT a status report.
`
