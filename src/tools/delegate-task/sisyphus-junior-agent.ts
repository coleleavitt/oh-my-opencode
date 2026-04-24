import { getAgentDisplayName } from "../../shared/agent-display-names"

/**
 * Lowercase config key for sisyphus-junior. This is what OpenCode's agent
 * registry expects in `.prompt()` body / `agents.get()` lookups. Sending
 * the display name here silently falls back to the `general` agent via
 * the background spawner's isAgentNotFoundError branch — that's how
 * category-based dispatch used to route to the wrong agent. Use this
 * anywhere an agent name is assigned to DelegateTaskArgs.subagent_type
 * or returned as agentToUse from a resolver.
 */
export const SISYPHUS_JUNIOR_AGENT = "sisyphus-junior"

/**
 * Human-readable display name for sisyphus-junior (for UI labels, toasts,
 * error messages shown to the user, etc.). Do NOT send this to OpenCode's
 * agent API.
 */
export const SISYPHUS_JUNIOR_DISPLAY = getAgentDisplayName("sisyphus-junior")
