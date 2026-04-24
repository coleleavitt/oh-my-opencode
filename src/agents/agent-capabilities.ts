/**
 * Dispatch-time capability flags for builtin agents — checked by
 * delegate-task's resolvers before spawning a subagent so mismatches
 * fail fast with a clear LLM-facing error instead of silently
 * running the task and having it fall over mid-stream.
 *
 * Keep flags orthogonal to AGENT_MODEL_REQUIREMENTS (which is about
 * model fallback resolution) — the two records answer different
 * questions and conflating them makes both harder to reason about.
 *
 * Add a capability: give the agent an entry in AGENT_CAPABILITIES
 * below keyed by lowercase config key. Partial entries are fine —
 * unspecified flags fall back to the permissive defaults documented
 * on each field.
 */

export interface AgentCapabilities {
  /**
   * MCP server names this agent requires to be connected at dispatch
   * time. Checked against the live connected-MCP set; if any declared
   * server is absent, subagent-resolver returns an error result to
   * the LLM naming the missing server(s) rather than spawning a task
   * that will fail when it hits an MCP tool.
   *
   * Server names must match `McpName` values in the connected-MCP
   * set (e.g. "playwright", "context7").
   */
  requiredMcpServers?: readonly string[]
  /**
   * Whether this agent is safe to dispatch with run_in_background=true.
   *
   * Default (when omitted): `true` — most agents work fine backgrounded.
   *
   * Set `false` for consultation / review agents whose entire value
   * proposition is giving the calling LLM a verdict BEFORE it does
   * more work — backgrounding those agents just makes the LLM
   * continue without the verdict. delegate-task will return an error
   * when run_in_background=true is passed for a backgroundCapable:
   * false agent.
   */
  backgroundCapable?: boolean
}

/**
 * Keyed by lowercase agent config key (see src/shared/agent-display-names.ts).
 * Agents NOT in this record implicitly have no requiredMcpServers and
 * backgroundCapable=true.
 */
export const AGENT_CAPABILITIES: Record<string, AgentCapabilities> = {
  oracle: {
    // Oracle is pure consultation — you ask, you wait for the answer,
    // you act on the answer. Backgrounding Oracle just means the
    // calling agent proceeds without the advice it requested.
    backgroundCapable: false,
  },
  argus: {
    // Argus is code review — the review must gate the continuation,
    // which only works sync. Background argus is a logical no-op.
    backgroundCapable: false,
  },
  "code-reviewer": {
    backgroundCapable: false,
  },
  "multimodal-looker": {
    // Multimodal looker uses browser automation via the Playwright MCP.
    // If that server isn't connected, the agent can't do its only job.
    requiredMcpServers: ["playwright"],
  },
}

/**
 * Returns the capabilities entry for a given agent config key, or an
 * empty object if the agent has no declared capabilities. Callers
 * should use the helper accessors below rather than reading fields
 * directly so defaults stay in one place.
 */
export function getAgentCapabilities(configKey: string): AgentCapabilities {
  return AGENT_CAPABILITIES[configKey.toLowerCase()] ?? {}
}

/**
 * True if the agent supports run_in_background=true. Defaults to true
 * for agents with no declared capability entry.
 */
export function isAgentBackgroundCapable(configKey: string): boolean {
  const entry = getAgentCapabilities(configKey)
  return entry.backgroundCapable !== false
}

/**
 * Returns the set of MCP server names this agent requires, or an empty
 * array if none declared.
 */
export function getAgentRequiredMcpServers(configKey: string): readonly string[] {
  return getAgentCapabilities(configKey).requiredMcpServers ?? []
}
