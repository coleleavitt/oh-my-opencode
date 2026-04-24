/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test"
import { SISYPHUS_JUNIOR_AGENT, SISYPHUS_JUNIOR_DISPLAY } from "./sisyphus-junior-agent"
import { normalizeAgentForPromptKey, getAgentConfigKey } from "../../shared/agent-display-names"

/**
 * Regression coverage for the bug where `task(category=...)` dispatch
 * routed to OpenCode's `general` fallback agent instead of
 * `sisyphus-junior`. Root cause: SISYPHUS_JUNIOR_AGENT held the display
 * name "Sisyphus-Junior", which OpenCode's strict `agents.get()` lookup
 * (keyed by lowercase config name) could not resolve, triggering
 * isAgentNotFoundError → FALLBACK_AGENT.
 */
describe("category dispatch → sisyphus-junior agent key", () => {
  it("SISYPHUS_JUNIOR_AGENT is the lowercase config key OpenCode expects", () => {
    // The key here is EXACTLY what gets sent to client.session.prompt({
    // body: { agent: ... } }) in the background path. If this reverts to
    // a display name, category-based dispatch breaks silently.
    expect(SISYPHUS_JUNIOR_AGENT).toBe("sisyphus-junior")
  })

  it("SISYPHUS_JUNIOR_DISPLAY is distinct from the config key — UI use only", () => {
    expect(SISYPHUS_JUNIOR_DISPLAY).toBe("Sisyphus-Junior")
    expect(SISYPHUS_JUNIOR_DISPLAY).not.toBe(SISYPHUS_JUNIOR_AGENT)
  })

  it("normalizeAgentForPromptKey maps both the key and the display name to the key", () => {
    // Both directions must collapse to the config key so an accidental
    // display-name dispatch still routes correctly.
    expect(normalizeAgentForPromptKey("sisyphus-junior")).toBe("sisyphus-junior")
    expect(normalizeAgentForPromptKey("Sisyphus-Junior")).toBe("sisyphus-junior")
    expect(normalizeAgentForPromptKey(" Sisyphus-Junior ")).toBe("sisyphus-junior")
  })

  it("getAgentConfigKey resolves display names for other known agents too", () => {
    // Blast radius sanity: every agent that has a display name different
    // from the config key must round-trip. Historical bugs surfaced
    // because Sisyphus / Atlas / Hephaestus / etc. all live behind
    // fancier display names.
    expect(getAgentConfigKey("Sisyphus - Ultraworker")).toBe("sisyphus")
    expect(getAgentConfigKey("Hephaestus - Deep Agent")).toBe("hephaestus")
    expect(getAgentConfigKey("Atlas - Plan Executor")).toBe("atlas")
    expect(getAgentConfigKey("Prometheus - Plan Builder")).toBe("prometheus")
    expect(getAgentConfigKey("Metis - Plan Consultant")).toBe("metis")
    expect(getAgentConfigKey("Momus - Plan Critic")).toBe("momus")
  })

  it("normalizeAgentForPromptKey preserves the exact spelling of unknown/custom agent names", () => {
    // A user-defined agent not in the builtin table must not be mangled
    // — OpenCode's registry keys custom agents on whatever the user wrote
    // in their opencode.json, including case. If we lowercased unknowns,
    // a user's "My_Agent": {...} would break.
    expect(normalizeAgentForPromptKey("my-custom-agent")).toBe("my-custom-agent")
    expect(normalizeAgentForPromptKey("Weird_Custom")).toBe("Weird_Custom")
  })
})
