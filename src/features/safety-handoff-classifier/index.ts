/**
 * Safety handoff classifier — post-subagent-completion check that flags
 * dangerous operations before the parent agent acts on the output.
 *
 * Ported from cc119's `u88` / `Oz$` pair (cli.2.1.119.aligned.js:302903).
 * cc119 uses a 2-stage LLM classifier; this port ships a heuristic
 * default so infrastructure is useful without an extra LLM round-trip.
 *
 * This module is INFRASTRUCTURE ONLY in its first release — the
 * heuristic classifier is complete and tested, but nothing in omo's
 * dispatch path consumes it yet. Wiring into delegate-task's sync
 * path is one conditional call (see commit message for rationale on
 * why it's deferred).
 */

export type {
  SafetyClassifierResult,
} from "./heuristic"

export {
  heuristicClassify,
  formatSecurityWarning,
} from "./heuristic"
