import { describe, expect, it } from "bun:test"
import { editCell, findCellIndex } from "./notebook-editor"
import type { NotebookCell, NotebookDocument } from "./types"

function makeNotebook(cells: NotebookCell[]): NotebookDocument {
  return { nbformat: 4, nbformat_minor: 5, metadata: {}, cells }
}

function makeCell(overrides: Partial<NotebookCell> & { id: string; cell_type: NotebookCell["cell_type"] }): NotebookCell {
  return {
    source: "",
    metadata: {},
    ...overrides,
  }
}

describe("findCellIndex", () => {
  it("#given cells with ids #when matching id exists #then returns its index", () => {
    const cells = [makeCell({ id: "a", cell_type: "code" }), makeCell({ id: "b", cell_type: "markdown" })]
    expect(findCellIndex(cells, "b")).toBe(1)
  })

  it("#given cells #when id does not exist #then returns -1", () => {
    const cells = [makeCell({ id: "a", cell_type: "code" })]
    expect(findCellIndex(cells, "missing")).toBe(-1)
  })
})

describe("editCell", () => {
  it("#given valid cell id #when editing source #then updates source and preserves metadata", () => {
    // given
    const notebook = makeNotebook([
      makeCell({ id: "c1", cell_type: "code", source: "old", metadata: { custom: true } }),
    ])

    // when
    const result = editCell({ notebook, cellId: "c1", newSource: "new code" })

    // then
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.updated.cells[0].source).toBe("new code")
    expect(result.updated.cells[0].metadata).toEqual({ custom: true })
  })

  it("#given missing cell id #when editing #then returns error", () => {
    // given
    const notebook = makeNotebook([makeCell({ id: "c1", cell_type: "code" })])

    // when
    const result = editCell({ notebook, cellId: "nope", newSource: "x" })

    // then
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("nope")
  })

  it("#given code cell #when changing type to markdown #then strips outputs and execution_count", () => {
    // given
    const notebook = makeNotebook([
      makeCell({ id: "c1", cell_type: "code", outputs: [{ text: "out" }], execution_count: 5 }),
    ])

    // when
    const result = editCell({ notebook, cellId: "c1", newSource: "# Title", newCellType: "markdown" })

    // then
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const cell = result.updated.cells[0]
    expect(cell.cell_type).toBe("markdown")
    expect(cell.outputs).toBeUndefined()
    expect(cell.execution_count).toBeUndefined()
  })

  it("#given code cell with outputs #when editing without type change #then preserves outputs", () => {
    // given
    const outputs = [{ output_type: "stream", text: "hello" }]
    const notebook = makeNotebook([
      makeCell({ id: "c1", cell_type: "code", source: "print('hi')", outputs, execution_count: 3 }),
    ])

    // when
    const result = editCell({ notebook, cellId: "c1", newSource: "print('bye')" })

    // then
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const cell = result.updated.cells[0]
    expect(cell.outputs).toEqual(outputs)
    expect(cell.execution_count).toBe(3)
  })

  it("#given markdown cell #when changing type to code #then preserves cell type as code", () => {
    // given
    const notebook = makeNotebook([makeCell({ id: "m1", cell_type: "markdown", source: "# Hello" })])

    // when
    const result = editCell({ notebook, cellId: "m1", newSource: "x = 1", newCellType: "code" })

    // then
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.updated.cells[0].cell_type).toBe("code")
    expect(result.updated.cells[0].source).toBe("x = 1")
  })

  it("#given multiple cells #when editing one #then leaves others unchanged", () => {
    // given
    const notebook = makeNotebook([
      makeCell({ id: "c1", cell_type: "code", source: "a = 1" }),
      makeCell({ id: "c2", cell_type: "code", source: "b = 2" }),
    ])

    // when
    const result = editCell({ notebook, cellId: "c2", newSource: "b = 99" })

    // then
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.updated.cells[0].source).toBe("a = 1")
    expect(result.updated.cells[1].source).toBe("b = 99")
  })
})
