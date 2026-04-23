# src/agents/ — 12 Agent Definitions

**Generated:** 2026-04-05

## OVERVIEW

Agent factories following `createXXXAgent(model) → AgentConfig` pattern. Each has static `mode` property. Built via `buildAgent()` compositing factory + categories + skills.

## AGENT INVENTORY

| Agent                     | Model                | Temp    | Mode     | Fallback Chain                                                           | Purpose                                                                                                                                                                                       |
| ------------------------- | -------------------- | ------- | -------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sisyphus**              | claude-opus-4-6 max  | 0.1     | all      | k2p5 -> kimi-k2.5 -> gpt-5.4 medium -> glm-5 -> big-pickle               | Main orchestrator, plans + delegates                                                                                                                                                          |
| **Hephaestus**            | gpt-5.4 medium       | 0.1     | all      | —                                                                        | Autonomous deep worker                                                                                                                                                                        |
| **Oracle**                | gpt-5.4 high         | 0.1     | subagent | gemini-3.1-pro high -> claude-opus-4-6 max                               | Read-only consultation                                                                                                                                                                        |
| **Librarian**             | minimax-m2.7         | 0.1     | subagent | minimax-m2.7-highspeed -> claude-haiku-4-5 -> gpt-5-nano                 | External docs/code search                                                                                                                                                                     |
| **Explore**               | grok-code-fast-1     | 0.1     | subagent | minimax-m2.7-highspeed -> minimax-m2.7 -> claude-haiku-4-5 -> gpt-5-nano | Contextual grep                                                                                                                                                                               |
| **Multimodal-Looker**     | gpt-5.3-codex medium | 0.1     | subagent | k2p5 -> gemini-3-flash -> glm-4.6v -> gpt-5-nano                         | PDF/image analysis                                                                                                                                                                            |
| **Metis**                 | claude-opus-4-6 max  | **0.3** | subagent | gpt-5.4 high -> gemini-3.1-pro high                                      | Pre-planning consultant                                                                                                                                                                       |
| **Momus**                 | gpt-5.4 xhigh        | 0.1     | subagent | claude-opus-4-6 max -> gemini-3.1-pro high                               | Plan reviewer                                                                                                                                                                                 |
| **Atlas**                 | claude-sonnet-4-6    | 0.1     | primary  | gpt-5.4 medium                                                           | Todo-list orchestrator                                                                                                                                                                        |
| **Prometheus**            | claude-opus-4-6 max  | 0.1     | —        | internal planner                                                         | Strategic planner (internal)                                                                                                                                                                  |
| **Sisyphus-Junior**       | claude-sonnet-4-6    | 0.1     | all      | user-configurable                                                        | Category-spawned executor                                                                                                                                                                     |
| **Argus** (code-reviewer) | claude-opus-4-6      | 0.1     | subagent | gpt-5.4 medium -> gemini-3.1-pro -> claude-sonnet-4-6                    | Multi-axis code review (5 axes → P-1/P-2/P-3/P-4 priority). Registered under Anthropic v117 canonical name `code-reviewer` with `argus` alias. See [Argus Skill Family](#argus-skill-family). |

## TOOL RESTRICTIONS

| Agent             | Denied Tools                                        |
| ----------------- | --------------------------------------------------- |
| Oracle            | write, edit, task, call_omo_agent                   |
| Librarian         | write, edit, task, call_omo_agent                   |
| Explore           | write, edit, task, call_omo_agent                   |
| Multimodal-Looker | ALL except read                                     |
| Atlas             | task, call_omo_agent                                |
| Momus             | write, edit, task                                   |
| Argus             | write, edit, apply_patch, hashline_edit, lsp_rename |

## STRUCTURE

```
agents/
├── sisyphus.ts            # 559 LOC, main orchestrator
├── hephaestus.ts          # 507 LOC, autonomous worker
├── oracle.ts              # Read-only consultant
├── librarian.ts           # External search
├── explore.ts             # Codebase grep
├── multimodal-looker.ts   # Vision/PDF
├── metis.ts               # Pre-planning
├── momus.ts               # Plan review
├── argus.ts               # 5-axis code review (Anthropic v117 code-reviewer)
├── atlas/agent.ts         # Todo orchestrator
├── types.ts               # AgentFactory, AgentMode
├── agent-builder.ts       # buildAgent() composition
├── utils.ts               # Agent utilities
├── builtin-agents.ts      # createBuiltinAgents() registry
├── dynamic-agent-prompt-builder.ts    # Dynamic prompt builder system
├── dynamic-agent-core-sections.ts   # Core prompt sections
├── dynamic-agent-policy-sections.ts # Policy prompt sections
├── dynamic-agent-tool-categorization.ts # Tool categorization
├── dynamic-agent-category-skills-guide.ts # Category skills guide
├── custom-agent-summaries.ts        # Custom agent summaries
├── env-context.ts                   # Environment context
└── builtin-agents/        # maybeCreateXXXConfig conditional factories
    ├── sisyphus-agent.ts
    ├── hephaestus-agent.ts
    ├── atlas-agent.ts
    ├── general-agents.ts  # collectPendingBuiltinAgents
    └── available-skills.ts
```

## FACTORY PATTERN

```typescript
const createXXXAgent: AgentFactory = (model: string) => ({
  instructions: "...",
  model,
  temperature: 0.1,
  // ...config
});
createXXXAgent.mode = "subagent"; // or "primary" or "all"
```

Model resolution: 4-step: override → category-default → provider-fallback → system-default. Defined in `shared/model-requirements.ts`.

## MODES

- **primary**: Respects UI-selected model, uses fallback chain
- **subagent**: Uses own fallback chain, ignores UI selection
- **all**: Available in both contexts (Sisyphus-Junior)

## Argus Skill Family

The Argus code-reviewer agent is invoked via skills that scope the review.
All 6 skills delegate to the `code-reviewer` subagent — the 5-axis taxonomy
lives in the agent's system prompt, not duplicated in skill templates.

| Skill            | Purpose                                      | Args                            |
| ---------------- | -------------------------------------------- | ------------------------------- |
| `argus-review`   | Default — uncommitted changes review         | none                            |
| `argus-pr`       | PR-style branch comparison                   | `<base-branch>` (default: main) |
| `argus-commit`   | Specific commit review (atomicity + bugs)    | `<commit-hash>` (default: HEAD) |
| `argus-security` | Security-focused audit (auto-promote to P-1) | none                            |
| `argus-custom`   | User-instructed review focus                 | `<instructions>`                |
| `argus-plan`     | Read-only planning mode (NOT a review skill) | none                            |

### 5-Axis Review Taxonomy

Every Argus finding includes:

1. **Impact** (CRITICAL/HIGH/MEDIUM/LOW) — what breaks
2. **Trigger** (ALWAYS/COMMON/RARE/NEVER-IN-PRACTICE) — how often hit
3. **Blast Radius** (SYSTEM-WIDE/MODULE/FILE/LOCAL) — propagation
4. **Fix Effort** (TRIVIAL/MODERATE/COMPLEX/ARCHITECTURAL) — time to fix
5. **Confidence** (CERTAIN/HIGH/MEDIUM/LOW) — reviewer certainty

Priority tier (P-1/P-2/P-3/P-4) is DERIVED from these axes via a
deterministic decision tree — never assigned by the LLM directly.

### Optional Auto-Review Hook

`src/hooks/argus-auto-review/` provides automatic Argus invocation after
N edit operations.

- **Env gate:** `OMO_ARGUS_AUTO_REVIEW=1` (default off)
- **Tunable:** `OMO_ARGUS_AUTO_REVIEW_THRESHOLD` (default 5),
  `OMO_ARGUS_AUTO_REVIEW_COOLDOWN_MS` (default 30000)
- **Non-blocking:** fires asynchronously, results inject into the next turn

### Related File Layout

```text
src/features/builtin-skills/skills/
├── argus-review.ts        # Default uncommitted-changes review
├── argus-pr.ts            # Branch comparison (origin/<base>...HEAD)
├── argus-commit.ts        # Commit-hash audit (HEAD by default)
├── argus-security.ts      # Security-only, HIGH-confidence, auto-P-1
├── argus-custom.ts        # Free-form user-instructed review
└── argus-plan.ts          # Read-only planning (forbids 5-axis output)

src/hooks/argus-auto-review/
├── hook.ts                     # Hook registration + dispatch
├── edit-threshold-detector.ts  # Counts edits, threshold + cooldown
├── review-invoker.ts           # Async Argus delegation
├── types.ts                    # Hook config types
└── index.ts                    # Public exports
```
