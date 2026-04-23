import { z } from "zod"

export const StatusLineConfigSchema = z.object({
  enabled: z.boolean().default(false),
  type: z.literal("command").default("command"),
  command: z.string().min(1).optional(),
  padding: z.number().int().min(0).optional(),
  output_file: z.string().optional(),
  timeout_ms: z.number().int().positive().default(5000),
})

export type StatusLineConfig = z.infer<typeof StatusLineConfigSchema>
