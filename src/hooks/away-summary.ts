import type { PluginInput } from "@opencode-ai/plugin"
import { createSystemDirective, SystemDirectiveTypes } from "../shared/system-directive"
import { log } from "../shared/logger"

const DEFAULT_AWAY_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
const MIN_AWAY_THRESHOLD_MS = 30 * 1000 // 30 seconds minimum

const AWAY_SUMMARY_PROMPT =
  "The user stepped away and is coming back. " +
  "Recap in under 40 words, 1-2 plain sentences, no markdown. " +
  "Lead with the overall goal and current task, then the one next action. " +
  "Skip root-cause narrative, fix internals, secondary to-dos, and em-dash tangents."

export interface AwaySummaryOptions {
  thresholdMs?: number
  enabled?: boolean
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

    const awaySummaryDirective = `${createSystemDirective(SystemDirectiveTypes.AWAY_SUMMARY)}

${AWAY_SUMMARY_PROMPT}

The user was away for approximately ${awayMinutes} minute${awayMinutes !== 1 ? "s" : ""}. Before addressing their new message, provide a brief recap of where things stand.`

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
  }) => {
    lastActivityPerSession.set(input.sessionID, Date.now())
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
      }
    }
  }

  return {
    messageHookBefore,
    toolExecuteAfter,
    eventHandler,
  }
}
