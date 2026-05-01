import type { ExperimentalConfig } from "../../config/schema/experimental"
import { log } from "../../shared/logger"

type McpRetryConfig = NonNullable<ExperimentalConfig["mcp_retry"]>

interface McpRetryState {
  attempts: Map<string, number>
  nextDelay: Map<string, number>
}

const TRANSIENT_ERROR_PATTERNS = [
  /ECONNREFUSED/,
  /ECONNRESET/,
  /ETIMEDOUT/,
  /socket hang up/i,
  /503/,
  /502/,
  /429/,
  /SSE.*error/i,
]

function isTransientError(error: string): boolean {
  return TRANSIENT_ERROR_PATTERNS.some((p) => p.test(error))
}

export function createMcpRetryHook(config?: McpRetryConfig) {
  const enabled = config?.enabled ?? true
  const maxAttempts = config?.max_attempts ?? 3
  const initialDelayMs = config?.initial_delay_ms ?? 1000
  const maxDelayMs = 30_000

  const state: McpRetryState = {
    attempts: new Map(),
    nextDelay: new Map(),
  }

  // TODO: OpenCode does not currently emit MCP lifecycle events (mcp.error,
  // mcp.disconnected) to plugins. When it does, replace the event handler
  // below with actual reconnect logic via ctx.client.mcp.reconnect() or
  // equivalent. For now this hook registers itself and logs readiness.
  log("[mcp-retry] hook registered (awaiting OpenCode MCP lifecycle events)", {
    enabled,
    maxAttempts,
    initialDelayMs,
  })

  const eventHandler = async ({ event }: { event: { type: string; properties?: unknown } }) => {
    if (!enabled) return

    const isMcpError = event.type === "mcp.error" || event.type === "mcp.disconnected"
    if (!isMcpError) return

    const props = event.properties as Record<string, unknown> | undefined
    const serverName = (props?.server as string) ?? (props?.name as string) ?? "unknown"
    const errorMsg = String(props?.error ?? props?.message ?? "")

    if (!isTransientError(errorMsg)) {
      log("[mcp-retry] non-transient MCP error, skipping retry", { serverName, error: errorMsg })
      return
    }

    const currentAttempts = state.attempts.get(serverName) ?? 0
    if (currentAttempts >= maxAttempts) {
      log("[mcp-retry] max attempts reached", { serverName, attempts: currentAttempts })
      state.attempts.delete(serverName)
      state.nextDelay.delete(serverName)
      return
    }

    const delay = state.nextDelay.get(serverName) ?? initialDelayMs
    state.attempts.set(serverName, currentAttempts + 1)
    state.nextDelay.set(serverName, Math.min(delay * 2, maxDelayMs))

    log("[mcp-retry] scheduling reconnect", {
      serverName,
      attempt: currentAttempts + 1,
      maxAttempts,
      delayMs: delay,
    })

    // TODO: When OpenCode exposes MCP reconnect API, call it here after delay.
    // setTimeout(() => { ctx.client.mcp.reconnect(serverName) }, delay)
  }

  const resetServer = (serverName: string) => {
    state.attempts.delete(serverName)
    state.nextDelay.delete(serverName)
  }

  return {
    event: eventHandler,
    resetServer,
    _state: state,
  }
}
