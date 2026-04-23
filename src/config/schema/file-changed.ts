import { z } from "zod"

export const FileChangedConfigSchema = z.object({
  enabled: z.boolean().default(false),
  initial_paths: z.array(z.string()).default([]),
  debounce_ms: z.number().int().positive().default(100),
})

export type FileChangedConfig = z.infer<typeof FileChangedConfigSchema>
