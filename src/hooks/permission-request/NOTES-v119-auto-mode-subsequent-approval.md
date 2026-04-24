# v119 `tengu_auto_mode_subsequent_approval` — investigation & decision not to port

## What it is in cc119

`cli.2.1.119.aligned.js:486937`:

```js
if (X) {
    let L = X;
    J.then((P) => {
        if (P.behavior === "allow") Q("tengu_auto_mode_subsequent_approval", {
            toolName: w7(z.name),
            msSinceDeny: Date.now() - L.timestamp,
            allowReasonType: P.decisionReason?.type
        }), A(L);
    });
}
```

Fires when a tool-permission check resolves to `allow` for a tool that
was **previously denied** in the same session (`L` is a prior-deny record
with a timestamp). Payload: `{ toolName, msSinceDeny, allowReasonType }`.
This is behavioral telemetry: how long after denying a tool does the
user/auto-mode reverse course, and why.

## Why this doesn't map to omo

omo's `src/hooks/permission-request/hook.ts` is a **stateless rule
matcher**:

```
match → allow  → pass through to OpenCode's permission flow
match → deny   → throw an error (permanent deny for THIS invocation)
no match       → pass through
```

No session state. No interactive approval UI. No "user denied once,
then allowed later" concept — a denied call is over; the agent can
re-request the tool on a later turn, but nothing tracks the prior
deny.

To port this meaningfully we'd need:
1. An interactive approval surface. omo doesn't own one — OpenCode
   does — and omo's permission hook is precisely the seam that keeps
   omo out of that business (it throws, OpenCode handles the dialog).
2. Per-session deny-history tracking keyed by tool + args. Today
   `hook.ts` holds no session state at all; adding a deny ledger
   would duplicate state OpenCode already tracks internally.
3. An "allow after deny" signal path. Neither the PluginInput client
   nor OpenCode's hook surface exposes a "this allow decision was
   preceded by a deny" edge — cc119 has this because it owns the
   dialog *and* the permission resolver.

The event measures a UX pattern that only exists when the plugin owns
the dialog. omo doesn't.

## Decision

Not porting. If OpenCode later exposes deny-history or prior-decision
metadata to plugins, revisit this — at that point it becomes a
thin pass-through log call. Until then, emitting this event would
require reimplementing the state omo deliberately delegates.
