import type { PluginInput } from "@opencode-ai/plugin"
import { createSystemDirective, SystemDirectiveTypes } from "../shared/system-directive"
import { log } from "../shared/logger"
import { loadMemories } from "../features/memory/store"

export function createMemoryInjectionHook(cwd: string, _ctx?: PluginInput) {
  const injectedSessions = new Set<string>()

  const messageHookBefore = async (input: {
    sessionID: string
    messages: Array<{ role: string; content: unknown }>
  }) => {
    const { sessionID, messages } = input

    if (injectedSessions.has(sessionID)) return

    const memoriesBlock = loadMemories(cwd)
    if (!memoriesBlock) {
      injectedSessions.add(sessionID)
      return
    }

    injectedSessions.add(sessionID)

    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== "user") return

    const directive = `${createSystemDirective(SystemDirectiveTypes.MEMORY_INJECTION)}\n\nThe following memories were saved from previous sessions. Use them to inform your behavior without re-asking for information the user has already provided.\n\n${memoriesBlock}`

    log(`[memory-injection] injecting ${memoriesBlock.split("<memory").length - 1} memories for session=${sessionID}`)

    if (typeof lastMessage.content === "string") {
      lastMessage.content = `${directive}\n\n${lastMessage.content}`
    } else if (Array.isArray(lastMessage.content)) {
      lastMessage.content = [{ type: "text", text: directive }, ...lastMessage.content]
    }
  }

  const eventHandler = async ({ event }: { event: { type: string; properties?: unknown } }) => {
    if (event.type === "session.deleted") {
      const props = event.properties as { sessionID?: string } | undefined
      if (props?.sessionID) injectedSessions.delete(props.sessionID)
    }
  }

  return { messageHookBefore, eventHandler }
}
