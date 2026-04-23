import { z } from "zod"

export const MemoryScopeSchema = z.enum(["user", "project", "local"])
export type MemoryScope = z.infer<typeof MemoryScopeSchema>

export const AutoMemoryConfigSchema = z.object({
  enabled: z.boolean().default(false),
  directory: z.string().optional(),
  auto_dream: z
    .object({
      enabled: z.boolean().default(false),
      consolidation_threshold: z.number().int().positive().default(10),
      max_memory_chars: z.number().int().positive().default(50_000),
    })
    .default({
      enabled: false,
      consolidation_threshold: 10,
      max_memory_chars: 50_000,
    }),
})
export type AutoMemoryConfig = z.infer<typeof AutoMemoryConfigSchema>
