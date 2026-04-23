import { z } from "zod"

export const ArgusAutoReviewModeSchema = z.enum([
  "pre-commit",
  "n-edits",
  "post-tool-use",
  "hybrid",
])

export const PLevelSchema = z.enum(["P-1", "P-2", "P-3", "P-4"])
export const ConfidenceSchema = z.enum(["low", "medium", "high", "certain"])

export const ArgusAutoReviewConfigSchema = z.object({
  enabled: z.boolean().default(false),
  mode: ArgusAutoReviewModeSchema.default("hybrid"),
  edit_threshold: z.number().int().positive().default(10),
  cooldown_ms: z.number().int().positive().default(900_000),
  block_on_p_levels: z
    .array(PLevelSchema)
    .default(["P-1", "P-2", "P-3", "P-4"]),
  confidence_threshold: ConfidenceSchema.default("high"),
  skill: z.string().default("argus-review"),
  timeout_ms: z.number().int().positive().default(180_000),
  auto_verify_after_n_tasks: z.number().int().min(0).default(3),
})

export type ArgusAutoReviewMode = z.infer<typeof ArgusAutoReviewModeSchema>
export type PLevel = z.infer<typeof PLevelSchema>
export type Confidence = z.infer<typeof ConfidenceSchema>
export type ArgusAutoReviewConfigInput = z.input<
  typeof ArgusAutoReviewConfigSchema
>
export type ArgusAutoReviewConfigValidated = z.infer<
  typeof ArgusAutoReviewConfigSchema
>
