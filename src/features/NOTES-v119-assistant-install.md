# v119 `tengu_assistant_install` — investigation & decision not to port

## What it is in cc119

`cli.2.1.119.aligned.js:438990-439032` — the enclosing code is an ink/React
form rendered as "New Assistant / Install a daemonized assistant" with
fields: `dir` (install directory), `name` (display name, "shown in the
mobile app and other Claude surfaces"), `permissionMode`, `model`. On
submit it calls `d94(dir, {permissionMode, assistantName, model})` + 
`a94(dir, undefined, name)` and emits:

```js
Q("tengu_assistant_install", { interactive: true, permission_mode: j });
```

## What this actually is

A v119 feature for registering a **daemonized** assistant: a long-lived
process, identified by a trusted directory and a display name, accessible
from "the mobile app and other Claude surfaces." This is the same v119
cluster of changes that introduced:

- `tengu_bg_adopt`  — supervisor adopts worker processes on startup
- `tengu_bg_attach` — client attaches to an existing supervisor session

Together these describe cc119's new daemon-assistant architecture. The
`tengu_assistant_install` event fires once, at registration time, via an
interactive TUI form.

## Why this doesn't map to omo

- **omo has no daemon lifecycle.** omo's "agents" (Sisyphus, Hephaestus,
  Oracle, Librarian, Explore, Atlas, Prometheus, Metis, Momus,
  Multimodal-Looker, Sisyphus-Junior) are in-process prompt templates
  dispatched through `createXXXAgent` factories. They don't persist past
  the plugin's OpenCode host lifetime. Nothing to register, nothing to
  install.
- **No mobile surface.** The companion infrastructure (`bg_adopt`,
  `bg_attach`) targets cc119's cross-surface daemon model — a single
  agent reachable from CLI, mobile, and other "Claude surfaces." omo is
  a plugin for the OpenCode host; surface-switching is OpenCode's
  concern, not omo's.
- **No install form precedent.** omo agents are config-driven
  (JSONC schemas at `src/config/schema/`); adding one is a config edit,
  not an interactive install flow. Building an install UI would
  introduce a capability class omo doesn't have and the Anthropic
  mobile surface can't consume.

## Decision

Not porting. The event measures a capability omo does not and will not
have under its current architecture. Documented here so the question
doesn't get re-asked when a future contributor diffs v119 event names
against the omo source.
