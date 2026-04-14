import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { saveMemory, listMemories } from "../features/memory/store"

export function createSaveMemoryTool(cwd: string): ToolDefinition {
  return tool({
    description: `Save a persistent memory to disk for future sessions.

Memories persist across sessions in ~/.config/opencode/oh-my-opencode/memory/<project>/

**When to save:**
- User corrects your approach ("don't do X", "stop Y") — save as feedback
- User confirms a non-obvious choice ("yes exactly", "keep doing that") — save as feedback
- You learn user role, preferences, or expertise level — save as user
- You learn project context, goals, deadlines, or motivation — save as project
- You learn where to find info in external systems (Linear, Grafana, Slack) — save as reference

**What NOT to save:**
- Code patterns, architecture, or file paths (read the code instead)
- Git history or recent changes (use git log/blame)
- Anything already in AGENTS.md or CLAUDE.md
- Ephemeral task details or current conversation context

Files are immutable — to update a memory, delete it and save a new one.`,
    args: {
      name: tool.schema.string().describe("Short 3-4 word kebab-case identifier, e.g. 'prefers-bun-over-npm'"),
      description: tool.schema.string().describe("One-line description — used to decide relevance in future sessions"),
      type: tool.schema.enum(["user", "feedback", "project", "reference"]).describe("user | feedback | project | reference"),
      content: tool.schema.string().describe(
        "Memory body — one paragraph about a single fact. For feedback/project types, structure as: rule/fact, then 'Why:' line and 'How to apply:' line",
      ),
    },
    execute: async (args) => {
      const { name, description, type, content } = args as {
        name: string
        description: string
        type: "user" | "feedback" | "project" | "reference"
        content: string
      }
      const existing = listMemories(cwd)
      const duplicate = existing.find((m) => m.name === name)
      const warning = duplicate
        ? `\n\nWarning: a memory named "${name}" already exists (${duplicate.filename}). Delete it first if you want to replace it.`
        : ""

      const filename = saveMemory(cwd, name, description, type, content)
      return `Saved memory: ${filename}${warning}`
    },
  })
}
