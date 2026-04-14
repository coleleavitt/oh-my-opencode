import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { listMemories } from "../features/memory/store"

export function createListMemoriesTool(cwd: string): ToolDefinition {
  return tool({
    description: "List all memories saved for this project. Shows filename, type, name, and description for each memory.",
    args: {},
    execute: async () => {
      const memories = listMemories(cwd)
      if (memories.length === 0) return "No memories stored for this project."

      const rows = memories.map(
        (m) => `  ${m.filename.padEnd(48)} [${m.type.padEnd(9)}] ${m.name}\n    ${m.description}`,
      )
      return `${memories.length} memor${memories.length === 1 ? "y" : "ies"} stored:\n\n${rows.join("\n")}`
    },
  })
}
