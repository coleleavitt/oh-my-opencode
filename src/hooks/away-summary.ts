import type { PluginInput } from "@opencode-ai/plugin"
import { createSystemDirective, SystemDirectiveTypes } from "../shared/system-directive"
import { log } from "../shared/logger"

const DEFAULT_AWAY_THRESHOLD_MS = 5 * 60 * 1000
const MIN_AWAY_THRESHOLD_MS = 30 * 1000

export interface AwaySummaryOptions {
  thresholdMs?: number
  enabled?: boolean
}

type SessionCounters = {
  toolCalls: number
  filesEdited: Set<string>
  errors: number
  lastToolName: string | null
}

function createSessionCounters(): SessionCounters {
  return { toolCalls: 0, filesEdited: new Set(), errors: 0, lastToolName: null }
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return "<1m"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

const FILE_EDIT_TOOLS = new Set(["write", "edit", "hashline_edit", "notebook_edit"])

function buildCounterSummary(counters: SessionCounters, awayMs: number): string {
  const duration = formatDuration(awayMs)
  const parts: string[] = []

  if (counters.toolCalls > 0) parts.push(`${counters.toolCalls} tool calls`)
  if (counters.filesEdited.size > 0) parts.push(`${counters.filesEdited.size} files edited`)
  if (counters.errors > 0) parts.push(`${counters.errors} error${counters.errors !== 1 ? "s" : ""} recovered`)

  if (parts.length === 0) return `While you were away (${duration}): no activity recorded.`

  const lastAction = counters.lastToolName ? ` Last action: ${counters.lastToolName}.` : ""
  return `While you were away (${duration}): ${parts.join(", ")}.${lastAction}`
}

export function createAwaySummaryHook(
  _ctx: PluginInput,
  options?: AwaySummaryOptions,
) {
  const thresholdMs = Math.max(
    MIN_AWAY_THRESHOLD_MS,
    options?.thresholdMs ?? DEFAULT_AWAY_THRESHOLD_MS,
  )
  const enabled = options?.enabled ?? true

  const lastActivityPerSession = new Map<string, number>()
  const countersPerSession = new Map<string, SessionCounters>()

  function getCounters(sessionID: string): SessionCounters {
    let c = countersPerSession.get(sessionID)
    if (!c) {
      c = createSessionCounters()
      countersPerSession.set(sessionID, c)
    }
    return c
  }

  function resetCounters(sessionID: string): void {
    countersPerSession.set(sessionID, createSessionCounters())
  }

  const messageHookBefore = async (input: {
    sessionID: string
    messages: Array<{ role: string; content: unknown }>
  }) => {
    if (!enabled) return

    const { sessionID, messages } = input
    const now = Date.now()
    const lastActivity = lastActivityPerSession.get(sessionID)

    lastActivityPerSession.set(sessionID, now)

    if (lastActivity === undefined) return
    if (messages.length === 0) return

    const awayMs = now - lastActivity
    if (awayMs < thresholdMs) return

    const awayMinutes = Math.round(awayMs / 60_000)

    log(
      `[away-summary] session=${sessionID} away=${awayMinutes}min (threshold=${Math.round(thresholdMs / 60_000)}min)`,
    )

    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role !== "user") return

    const counters = getCounters(sessionID)
    const counterSummary = buildCounterSummary(counters, awayMs)
    resetCounters(sessionID)

    const awaySummaryDirective = `${createSystemDirective(SystemDirectiveTypes.AWAY_SUMMARY)}

${counterSummary}

The user was away for approximately ${awayMinutes} minute${awayMinutes !== 1 ? "s" : ""}. Before addressing their new message, provide a brief recap of where things stand in 1-2 plain sentences.`

    if (typeof lastMessage.content === "string") {
      lastMessage.content = `${awaySummaryDirective}\n\n${lastMessage.content}`
    } else if (Array.isArray(lastMessage.content)) {
      lastMessage.content = [
        { type: "text", text: awaySummaryDirective },
        ...lastMessage.content,
      ]
    }
  }

  const toolExecuteAfter = async (input: {
    sessionID: string
    tool?: string
    output?: string
  }) => {
    lastActivityPerSession.set(input.sessionID, Date.now())

    const counters = getCounters(input.sessionID)
    counters.toolCalls += 1
    if (input.tool) {
      counters.lastToolName = input.tool
      if (FILE_EDIT_TOOLS.has(input.tool)) {
        counters.filesEdited.add(`${input.tool}:${counters.toolCalls}`)
      }
    }
  }

  const eventHandler = async ({
    event,
  }: {
    event: { type: string; properties?: unknown }
  }) => {
    if (event.type === "session.deleted") {
      const props = event.properties as { sessionID?: string } | undefined
      if (props?.sessionID) {
        lastActivityPerSession.delete(props.sessionID)
        countersPerSession.delete(props.sessionID)
      }
    }

    if (event.type === "session.error") {
      const props = event.properties as { sessionID?: string } | undefined
      if (props?.sessionID) {
        const counters = getCounters(props.sessionID)
        counters.errors += 1
      }
    }
  }

  return {
    messageHookBefore,
    toolExecuteAfter,
    eventHandler,
  }
}
