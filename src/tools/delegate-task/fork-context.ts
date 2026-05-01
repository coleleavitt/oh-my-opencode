import type { OpencodeClient } from "./types"
import type { SessionMessage } from "./executor-types"
import { normalizeSDKResponse } from "../../shared"
import { log } from "../../shared/logger"

const MAX_FORK_MESSAGES = 10
const MAX_FORK_CHARS = 8000

/**
 * Build fork context from the parent session's recent messages.
 * Returns an XML-wrapped transcript of the last N messages (capped by
 * count and character limit), or undefined if messages can't be read.
 */
export async function buildForkContext(
  client: OpencodeClient,
  parentSessionID: string,
): Promise<string | undefined> {
  try {
    const resp = await client.session.messages({ path: { id: parentSessionID } })
    const messages = normalizeSDKResponse(resp, [] as SessionMessage[])

    if (messages.length === 0) return undefined

    // Take the last N messages
    const recent = messages.slice(-MAX_FORK_MESSAGES)
    const lines: string[] = []
    let totalChars = 0

    for (const msg of recent) {
      const role = msg.info?.role ?? "unknown"
      const textParts = (msg.parts ?? [])
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text!)

      if (textParts.length === 0) continue

      const text = textParts.join("\n")
      const entry = `[${role}] ${text}`

      if (totalChars + entry.length > MAX_FORK_CHARS) {
        // Truncate the last entry to fit
        const remaining = MAX_FORK_CHARS - totalChars
        if (remaining > 100) {
          lines.push(`[${role}] ${text.slice(0, remaining - 20)}... (truncated)`)
        }
        break
      }

      lines.push(entry)
      totalChars += entry.length
    }

    if (lines.length === 0) return undefined

    const messageCount = lines.length
    log("[fork] inherited " + messageCount + " messages from parent " + parentSessionID)

    return `<fork-context>
${lines.join("\n\n")}
</fork-context>

You are a worker fork. The transcript above is the parent's history — inherited reference, not your situation. Focus on the task below.`
  } catch (err) {
    log("[fork] failed to read parent messages", { parentSessionID, error: String(err) })
    return undefined
  }
}
