export interface NotebookEditParams {
  notebook_path: string
  cell_id: string
  new_source: string
  cell_type?: "code" | "markdown"
}

export interface NotebookCell {
  id?: string
  cell_type: "code" | "markdown" | "raw"
  source: string | string[]
  metadata?: Record<string, unknown>
  outputs?: unknown[]
  execution_count?: number | null
}

export interface NotebookDocument {
  nbformat: number
  nbformat_minor: number
  metadata: Record<string, unknown>
  cells: NotebookCell[]
}
