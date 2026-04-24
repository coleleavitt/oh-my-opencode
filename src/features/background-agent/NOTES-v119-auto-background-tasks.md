# v119 `CLAUDE_AUTO_BACKGROUND_TASKS` — investigation & decision not to port

## What it is in cc119

`cli.2.1.119.aligned.js:309217-309220`:

```js
function kX1() {
    if (SH(process.env.CLAUDE_AUTO_BACKGROUND_TASKS) || k$("tengu_auto_background_agents", !1)) return 12e4;
    return 0;
}
```

Caller (`cli.2.1.119.aligned.js:309574`):

```js
let nH = JJ7({
    agentId: DH,
    description: q,
    prompt: H,
    ...
    autoBackgroundMs: kX1() || void 0,
    cwd: a
});
e = nH.taskId;
KH = nH.backgroundSignal.then(() => ({ type: "background" }));
zH = nH.cancelAutoBackground;
```

`autoBackgroundMs = 120000ms` (2min) when the env var is truthy **or** the
`tengu_auto_background_agents` experiment flag is on. The task spawner
(`JJ7`) returns a `backgroundSignal` promise that resolves after this
budget elapses, at which point the task is moved from the sync foreground
into background mode with `cancelAutoBackground` as the opt-out handle.

## Not new in v119

`grep -c 'CLAUDE_AUTO_BACKGROUND'` in both aligned bundles returns 1 each.
The env var is in v118 too, same call shape. It was mis-classified as
"new in v119" in the upstream audit. No v119-specific delta to port.

## Why this is not a drop-in `OMO_DISABLE_UPDATES`-style port

The v118 port of `OMO_DISABLE_UPDATES` (commit 8499ba76) added one early
return to an existing decision point — ~10 LOC. This feature is different:

1. **omo's sync path is structurally different.** `run_in_background` is
   an explicit tool-call argument the delegating model chooses up-front
   (see `src/tools/delegate-task/tools.ts:129-147`). There's no mid-flight
   "move to background after N seconds" mechanism in the sync execution
   path (`executeSyncContinuation`, `sync-task.ts`) — adding one means
   threading cancel-and-respawn logic through the whole sync pipeline.

2. **omo's background is tmux-based**, not a subprocess promise with a
   `backgroundSignal`. Moving a task mid-flight from sync to tmux would
   require serialising conversation state to the bg session store,
   which cc119's in-process "promote this promise to background" model
   doesn't need to solve.

3. **The primary value is an LLM UX nudge, not a capability gap.** omo
   already exposes `run_in_background` directly to the delegating agent,
   which is a stronger affordance than a hardcoded 120s timer.

## Decision

Not porting. Documented here so the question doesn't get re-asked. If a
future omo release adds a promotable sync→tmux migration path, revisit
this and wire `OMO_AUTO_BACKGROUND_TASKS` onto that mechanism rather
than inventing a parallel one.
