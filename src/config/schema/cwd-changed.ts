import { z } from "zod"

export const CwdChangedConfigSchema = z.object({
  enabled: z.boolean().default(false),
})

export type CwdChangedConfig = z.infer<typeof CwdChangedConfigSchema>
