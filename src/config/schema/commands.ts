import { z } from "zod"

export const BuiltinCommandNameSchema = z.enum([
  "init-deep",
  "ralph-loop",
  "ulw-loop",
  "cancel-ralph",
  "refactor",
  "start-work",
  "stop-continuation",
  "remove-ai-slops",
  "security-review",
  "thinking-off",
  "thinking-on",
  "effort-xhigh",
])

export type BuiltinCommandName = z.infer<typeof BuiltinCommandNameSchema>
