import type { Message, Part } from "@opencode-ai/sdk"

import type { CreatedHooks } from "../create-hooks"

type MessageWithParts = {
  info: Message
  parts: Part[]
}

type MessagesTransformOutput = { messages: MessageWithParts[] }

function toSimpleMessages(output: MessagesTransformOutput): Array<{ role: string; content: unknown }> {
  return output.messages.map((m) => {
    const textParts = m.parts
      .filter((p) => "text" in p && typeof p.text === "string")
      .map((p) => (p as { text: string }).text)
    return {
      role: m.info.role,
      content: textParts.length === 1 ? textParts[0] : textParts.join("\n"),
    }
  })
}

export function createMessagesTransformHandler(args: {
  hooks: CreatedHooks
}): (input: Record<string, never>, output: MessagesTransformOutput) => Promise<void> {
  return async (input, output): Promise<void> => {
    if (args.hooks.awaySummary?.messageHookBefore && output.messages.length > 0) {
      const lastMsg = output.messages[output.messages.length - 1]
      const sessionID = lastMsg?.info.sessionID
      if (sessionID) {
        const simpleMessages = toSimpleMessages(output)
        await args.hooks.awaySummary.messageHookBefore({ sessionID, messages: simpleMessages })
      }
    }

    await args.hooks.contextInjectorMessagesTransform?.[
      "experimental.chat.messages.transform"
    ]?.(input, output)

    await args.hooks.thinkingBlockValidator?.[
      "experimental.chat.messages.transform"
    ]?.(input, output)

    await args.hooks.toolPairValidator?.[
      "experimental.chat.messages.transform"
    ]?.(input, output)
  }
}
