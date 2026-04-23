import type { NotebookCell, NotebookDocument } from "./types"

export function findCellIndex(cells: readonly NotebookCell[], cellId: string): number {
  return cells.findIndex((c) => c.id === cellId)
}

export function editCell(params: {
  notebook: NotebookDocument
  cellId: string
  newSource: string
  newCellType?: "code" | "markdown"
}): { ok: true; updated: NotebookDocument } | { ok: false; error: string } {
  const { notebook, cellId, newSource, newCellType } = params
  const idx = findCellIndex(notebook.cells, cellId)
  if (idx === -1) {
    return { ok: false, error: `Cell with id "${cellId}" not found` }
  }

  const existing = notebook.cells[idx]
  const updatedCell: NotebookCell = {
    ...existing,
    cell_type: newCellType ?? existing.cell_type,
    source: newSource,
  }

  if (updatedCell.cell_type === "markdown") {
    delete updatedCell.outputs
    delete updatedCell.execution_count
  }

  const updatedCells = [...notebook.cells]
  updatedCells[idx] = updatedCell
  return {
    ok: true,
    updated: { ...notebook, cells: updatedCells },
  }
}
