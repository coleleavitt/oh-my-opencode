import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { deleteMemory } from "../features/memory/store"

export function createDeleteMemoryTool(cwd: string): ToolDefinition {
  return tool({
    description: "Delete a memory file from the persistent memory store. Use this to remove stale or incorrect memories before saving an updated version.",
    args: {
      filename: tool.schema.string().describe("Filename of the memory to delete, e.g. 'prefers-bun-over-npm.md'"),
    },
    execute: async (args) => {
      const { filename } = args as { filename: string }
      const deleted = deleteMemory(cwd, filename)
      return deleted ? `Deleted memory: ${filename}` : `Memory not found: ${filename}`
    },
  })
}
