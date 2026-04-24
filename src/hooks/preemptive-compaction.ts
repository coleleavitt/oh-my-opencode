import { log } from "../shared/logger"
import type { OhMyOpenCodeConfig } from "../config"
import {
  resolveActualContextLimit,
  type ContextLimitModelCacheState,
} from "../shared/context-limit-resolver"

import { resolveCompactionModel } from "./shared/compaction-model-resolver"
import { createRapidRefillBreaker } from "./shared/rapid-refill-breaker"
import { createPostCompactionDegradationMonitor } from "./preemptive-compaction-degradation-monitor"

const PREEMPTIVE_COMPACTION_TIMEOUT_MS = 60_000
const PREEMPTIVE_COMPACTION_COOLDOWN_MS = 60_000

// CC v105: e48() computes threshold as (contextWindow - reserveTokens).
// For 200K context → 78% = ~156K. For 1M context → ~85% = ~850K.
// Reserve 44K tokens for the response + tools regardless of window size.
const COMPACT_RESERVE_TOKENS = 44_000
const FALLBACK_THRESHOLD = 0.78

function getCompactThreshold(actualLimit: number): number {
  const pctOverride = process.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE
  if (pctOverride) {
    const pct = parseFloat(pctOverride)
    if (!isNaN(pct) && pct > 0 && pct <= 100) return pct / 100
  }
  const computed = (actualLimit - COMPACT_RESERVE_TOKENS) / actualLimit
  return Math.max(0.5, Math.min(computed, 0.92))
}

declare function setTimeout(handler: () => void, timeout?: number): unknown
declare function clearTimeout(timeoutID: unknown): void

interface TokenInfo {
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
}

interface CachedCompactionState {
  providerID: string
  modelID: string
  tokens: TokenInfo
}

async function withTimeout<TValue>(
  promise: Promise<TValue>,
  timeoutMs: number,
  errorMessage: string,
): Promise<TValue> {
  let timeoutID: unknown

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutID = setTimeout(() => {
      reject(new Error(errorMessage))
    }, timeoutMs)
  })

  return await Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutID)
  })
}

type PluginInput = {
  client: {
    session: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: (...args: any[]) => any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      summarize: (...args: any[]) => any
    }
    tui: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      showToast: (...args: any[]) => any
    }
  }
  directory: string
}

export function createPreemptiveCompactionHook(
  ctx: PluginInput,
  pluginConfig: OhMyOpenCodeConfig,
  modelCacheState?: ContextLimitModelCacheState,
) {
  const compactionInProgress = new Set<string>()
  const compactedSessions = new Set<string>()
  const lastCompactionTime = new Map<string, number>()
  const tokenCache = new Map<string, CachedCompactionState>()
  const rapidRefillBreaker = createRapidRefillBreaker()

  const postCompactionMonitor = createPostCompactionDegradationMonitor({
    client: ctx.client,
    directory: ctx.directory,
    pluginConfig,
    tokenCache,
    compactionInProgress,
  })

  const toolExecuteAfter = async (
    input: { tool: string; sessionID: string; callID: string },
    _output: { title: string; output: string; metadata: unknown }
  ) => {
    const { sessionID } = input
    if (compactedSessions.has(sessionID) || compactionInProgress.has(sessionID)) return

    const lastTime = lastCompactionTime.get(sessionID)
    if (lastTime && Date.now() - lastTime < PREEMPTIVE_COMPACTION_COOLDOWN_MS) return

    const cached = tokenCache.get(sessionID)
    if (!cached) return

    const actualLimit = resolveActualContextLimit(
      cached.providerID,
      cached.modelID,
      modelCacheState,
    )

    if (actualLimit === null) {
      log("[preemptive-compaction] Skipping preemptive compaction: unknown context limit for model", {
        providerID: cached.providerID,
        modelID: cached.modelID,
      })
      return
    }

    const totalInputTokens = (cached.tokens.input ?? 0) + (cached.tokens.cache?.read ?? 0)
    const usageRatio = totalInputTokens / actualLimit
    const threshold = getCompactThreshold(actualLimit)
    if (usageRatio < threshold || !cached.modelID) return

    const breakerDecision = rapidRefillBreaker.shouldAllowCompact(sessionID)
    if (!breakerDecision.allowed) {
      log("[preemptive-compaction] Rapid-refill breaker tripped — skipping auto-compaction for this session", {
        sessionID,
        refills: breakerDecision.refills,
      })
      ctx.client.tui.showToast({
        body: {
          title: "Auto-compaction paused",
          message: `Context refilled past ${Math.round(threshold * 100)}% within a few turns on ${breakerDecision.refills} consecutive compactions. Auto-compaction is disabled for this session — run /compact manually if you want to continue compacting.`,
          variant: "warning",
          duration: 10000,
        },
      }).catch((toastError: unknown) => {
        log("[preemptive-compaction] Failed to show breaker toast", {
          sessionID,
          toastError: String(toastError),
        })
      })
      return
    }

    compactionInProgress.add(sessionID)
    lastCompactionTime.set(sessionID, Date.now())

    try {
      const { providerID: targetProviderID, modelID: targetModelID } = resolveCompactionModel(
        pluginConfig,
        sessionID,
        cached.providerID,
        cached.modelID,
      )

      await withTimeout(
        ctx.client.session.summarize({
          path: { id: sessionID },
          body: { providerID: targetProviderID, modelID: targetModelID, auto: true } as never,
          query: { directory: ctx.directory },
        }),
        PREEMPTIVE_COMPACTION_TIMEOUT_MS,
        `Compaction summarize timed out after ${PREEMPTIVE_COMPACTION_TIMEOUT_MS}ms`,
      )

      compactedSessions.add(sessionID)
      rapidRefillBreaker.recordSuccessfulCompact(sessionID)
    } catch (error) {
      log("[preemptive-compaction] Compaction failed", {
        sessionID,
        providerID: cached.providerID,
        modelID: cached.modelID,
        error: String(error),
      })
      ctx.client.tui.showToast({
        body: {
          title: "Preemptive compaction failed",
          message: `Context window is above ${Math.round(getCompactThreshold(actualLimit) * 100)}% and auto-compaction could not run. The session may grow large. Error: ${String(error)}`,
          variant: "warning",
          duration: 10000,
        },
      }).catch((toastError: unknown) => {
        log("[preemptive-compaction] Failed to show toast", {
          sessionID,
          toastError: String(toastError),
        })
      })
    } finally {
      compactionInProgress.delete(sessionID)
    }
  }

  const eventHandler = async ({ event }: { event: { type: string; properties?: unknown } }) => {
    const props = event.properties as Record<string, unknown> | undefined

    if (event.type === "session.deleted") {
      const sessionID = (props?.info as { id?: string } | undefined)?.id
      if (sessionID) {
        compactionInProgress.delete(sessionID)
        compactedSessions.delete(sessionID)
        lastCompactionTime.delete(sessionID)
        tokenCache.delete(sessionID)
        rapidRefillBreaker.clearSession(sessionID)
        postCompactionMonitor.clear(sessionID)
      }
      return
    }

    if (event.type === "session.compacted") {
      const sessionID = (props?.sessionID as string | undefined)
        ?? (props?.info as { id?: string } | undefined)?.id
      if (sessionID) {
        postCompactionMonitor.onSessionCompacted(sessionID)
      }
      return
    }

    if (event.type === "message.updated") {
      const info = props?.info as {
        id?: string
        role?: string
        sessionID?: string
        providerID?: string
        modelID?: string
        finish?: boolean
        tokens?: TokenInfo
      } | undefined

      if (!info || info.role !== "assistant" || !info.finish || !info.sessionID) return

      if (info.providerID && info.tokens) {
        tokenCache.set(info.sessionID, {
          providerID: info.providerID,
          modelID: info.modelID ?? "",
          tokens: info.tokens,
        })
      }
      compactedSessions.delete(info.sessionID)
      rapidRefillBreaker.recordAssistantTurn(info.sessionID)

      await postCompactionMonitor.onAssistantMessageUpdated({
        sessionID: info.sessionID,
        id: info.id,
      })
    }
  }

  return {
    "tool.execute.after": toolExecuteAfter,
    event: eventHandler,
  }
}
