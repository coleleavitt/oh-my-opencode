import { readFile, writeFile } from "node:fs/promises"
import { rename } from "node:fs/promises"
import { isAbsolute } from "node:path"
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { log } from "../../shared/logger"
import { editCell } from "./notebook-editor"
import type { NotebookDocument } from "./types"

export function createNotebookEditTool(): ToolDefinition {
  return tool({
    description:
      "Edit a specific cell in a Jupyter notebook by cell ID. Use this for surgical cell edits instead of full-file rewrites.",
    args: {
      notebook_path: tool.schema.string().describe("Absolute path to the Jupyter notebook file"),
      cell_id: tool.schema.string().describe("Cell ID to edit"),
      new_source: tool.schema.string().describe("New cell source content"),
      cell_type: tool.schema.enum(["code", "markdown"]).optional().describe("Optionally change cell type"),
    },
    execute: async (args) => {
      const { notebook_path, cell_id, new_source, cell_type } = args as {
        notebook_path: string
        cell_id: string
        new_source: string
        cell_type?: "code" | "markdown"
      }

      if (!isAbsolute(notebook_path)) {
        throw new Error(`notebook_path must be absolute: ${notebook_path}`)
      }

      const raw = await readFile(notebook_path, "utf8")
      let notebook: NotebookDocument
      try {
        notebook = JSON.parse(raw) as NotebookDocument
      } catch (err) {
        throw new Error(`Failed to parse notebook JSON: ${String(err)}`)
      }

      const result = editCell({
        notebook,
        cellId: cell_id,
        newSource: new_source,
        newCellType: cell_type,
      })

      if (!result.ok) {
        throw new Error(result.error)
      }

      const tmpPath = notebook_path + ".tmp"
      await writeFile(tmpPath, JSON.stringify(result.updated, null, 2) + "\n")
      await rename(tmpPath, notebook_path)
      log("[notebook_edit] Cell updated", { path: notebook_path, cellId: cell_id })

      return `Edited cell "${cell_id}" in ${notebook_path}`
    },
  })
}
