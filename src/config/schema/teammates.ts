import { z } from "zod"

/**
 * Teammates = named, addressable, long-running subagents addressable
 * across turns via `send_message_to_teammate`. See
 * src/features/teammates/DESIGN.md for the full architecture.
 */
export const TeammatesConfigSchema = z.object({
  /** Master switch. When false, teammate=true on delegate-task is ignored. */
  enabled: z.boolean().default(true),
  /** Max concurrent teammates per parent session. Reusing a name
   * does NOT consume a slot. */
  max_concurrent: z.number().int().positive().default(5),
})

export type TeammatesConfig = z.infer<typeof TeammatesConfigSchema>
