# Teammates / persistent mailbox — design doc

**Status:** proposed, not implemented. Committed as a place-marker so the design is
reviewable before code lands.

## Motivation

cc119 (cli.2.1.119.aligned.js:309278-309838) supports dispatching subagents that persist
*past the originating tool call*. The parent addresses them by stable `agentId` + `name`
and can send follow-up prompts via `SendMessage`, producing long-lived "teammates" that
maintain their own conversation context across turns. cc119's UI renders these in a
split-pane with a mailbox metaphor.

omo today dispatches subagents per-call. When a delegated task finishes, the sub-session
goes cold — the parent can resume it by passing `session_id`, but there's no notion of a
*named*, *addressable*, *running* teammate the parent can nudge without re-invoking
`delegate-task` from scratch. This is the single largest delegation-surface capability
gap.

## Rough shape (not decided)

Three concrete additions:

### 1. Teammate registry

`src/features/teammates/registry.ts`: in-memory map `name → { sessionID, agent, status,
lastActivityAt, parentSessionID }`. Entries added on `delegate-task(..., teammate: true,
name: "<stable-name>")`. Cleared on explicit `dismiss_teammate` tool call or on parent
session end (via the same `event: session.deleted` hook the existing session state
consumers use).

Key decisions needed before implementation:

- **Scope.** Per-parent-session? Per-directory? Global? Leaning **per-parent-session**
  (matches how users think about "my current task" and maps cleanly to cc119's
  parent→child relationship). Global would produce cross-task contamination; per-directory
  loses the mental model of "I'm in this workflow."

- **Name collisions.** If the parent calls `delegate-task(..., teammate: true,
  name: "researcher")` twice, do we reuse the existing session, reject, or spawn a new one
  with a suffix? cc119 reuses. Leaning reuse — the user intent is clearly "talk to my
  researcher again."

- **Capacity.** Hard cap or config? Probably **config-driven** (`teammates.max_concurrent`,
  default 5) to bound resource use.

### 2. `send_message_to_teammate` tool

New top-level tool in the tool registry, alongside `delegate-task`. Schema:

```ts
{
  name: string,           // the teammate's stable name
  prompt: string,         // new message to send
  run_in_background: boolean,
}
```

Resolves `name → sessionID` via the registry, then calls the existing
`executeSyncContinuation` / `executeBackgroundContinuation` plumbing (the `session_id`
path already exists in `delegate-task/tools.ts`). The tool is effectively sugar over
`delegate-task(session_id=<looked-up>, ...)` with a name-based affordance.

Key decisions needed:

- **Failure mode when teammate not found.** Clear error naming the attempted name and
  listing currently-registered teammates? Auto-spawn? Leaning **clear error** — auto-spawn
  is magical and contradicts the explicit `delegate-task(..., teammate: true)` step.

- **Parallel send.** Can the parent `send_message_to_teammate` to several teammates in
  one turn and get results back as they arrive? cc119 supports this via `Promise.all`.
  omo's sync continuation is blocking; making it parallel needs a fan-out helper. **Defer
  to v2** — v1 is one teammate per tool call, parent can call the tool multiple times in
  a turn and the LLM chooses whether to await sequentially or background.

### 3. `list_teammates` / `dismiss_teammate` tools

Observability + lifecycle. Small tools, shape:

```ts
list_teammates: () => { name, agent, status, lastActivityAt }[]
dismiss_teammate: (name: string) => { dismissed: boolean }
```

`dismiss_teammate` deletes the registry entry and aborts the underlying session.

## Implementation phases

1. **Registry + types + unit tests** (~3 hrs). Pure in-memory state, no dispatch
   integration.
2. **Wire `teammate: boolean` + `name: string` args into `delegate-task`** (~2 hrs).
   Registry entry created on successful spawn; no-op if flag not set.
3. **`send_message_to_teammate` tool** (~3 hrs). New tool in the registry, delegates to
   existing continuation path via the looked-up sessionID.
4. **`list_teammates` + `dismiss_teammate` tools** (~2 hrs).
5. **Session-end cleanup hook** (~1 hr). Subscribe to `session.deleted` event, clear
   registry entries where `parentSessionID` matches.
6. **Integration tests** (~2 hrs) — full parent→teammate→send→dismiss flow against a
   fake client.

Rough total: **13 hrs of focused work** (~2 working days) assuming no surprises. Biggest
unknown: how omo's existing `session_id` continuation plumbing interacts with an
already-running session that's mid-response (cc119 has an explicit mailbox queue; omo's
continuation path assumes the child session is idle).

## Deliberately deferred

- **TUI split-pane UX.** cc119 renders teammates in a split-pane; omo is an OpenCode
  plugin that doesn't own the TUI. Surfacing teammate status is OpenCode's concern —
  probably via existing task-toast manager. Not scoped here.
- **Cross-session persistence.** cc119's daemon architecture can adopt teammates across
  Claude Code restarts. omo's plugin lifecycle doesn't support that; see
  `NOTES-v119-assistant-install.md` and `NOTES-v119-auto-background-tasks.md` for
  architectural constraints.
- **Tool-use cost accounting for teammates.** The parent's turn includes tool-use
  counts; a teammate's tool usage inside a continuation should probably roll up to the
  parent's budget, but the exact shape needs a spec. Defer to a second design round.

## Open questions for cole

1. Per-parent-session scope OK, or do you want per-directory?
2. Teammate name collision → reuse, reject, or suffix?
3. Capacity cap in config or hard-coded?
4. Is `send_message_to_teammate` the right tool name, or prefer `tell`, `msg`, or
   something shorter for the LLM to reach for reflexively?

Answer those and implementation is well-scoped.
