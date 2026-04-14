import { z } from "zod"

export const MemoryTypeSchema = z.enum(["user", "feedback", "project", "reference"])
export type MemoryType = z.infer<typeof MemoryTypeSchema>

export const MemoryFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: MemoryTypeSchema,
})
export type MemoryFrontmatter = z.infer<typeof MemoryFrontmatterSchema>

export interface MemoryFile {
  filename: string
  filepath: string
  name: string
  description: string
  type: MemoryType
  content: string
}

export const SaveMemoryInputSchema = z.object({
  name: z.string().min(1).describe("Short 3-4 word identifier, e.g. 'prefers-bun-over-npm'"),
  description: z.string().min(1).describe("One-line description used to decide relevance in future conversations"),
  type: MemoryTypeSchema.describe("user | feedback | project | reference"),
  content: z.string().min(1).describe("Memory body. For feedback/project types: lead with the rule/fact, then Why: and How to apply: lines"),
})
export type SaveMemoryInput = z.infer<typeof SaveMemoryInputSchema>

export const DeleteMemoryInputSchema = z.object({
  filename: z.string().min(1).describe("Filename of the memory to delete, e.g. 'prefers-bun-over-npm.md'"),
})
export type DeleteMemoryInput = z.infer<typeof DeleteMemoryInputSchema>
