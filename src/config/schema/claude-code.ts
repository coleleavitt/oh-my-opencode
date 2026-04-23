import { z } from "zod"

export const ClaudeCodeConfigSchema = z.object({
  mcp: z.boolean().optional(),
  commands: z.boolean().optional(),
  skills: z.boolean().optional(),
  agents: z.boolean().optional(),
  hooks: z.boolean().optional(),
  plugins: z.boolean().optional(),
  plugins_override: z.record(z.string(), z.boolean()).optional(),
  md_excludes: z
    .array(z.string())
    .optional()
    .describe("Glob patterns to exclude specific AGENTS.md/CLAUDE.md/README.md files from auto-loading"),
})

export type ClaudeCodeConfig = z.infer<typeof ClaudeCodeConfigSchema>
