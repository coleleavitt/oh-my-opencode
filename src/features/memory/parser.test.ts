import { describe, it, expect } from "bun:test"
import { parseFrontmatter, serializeFrontmatter } from "./parser"

describe("parseFrontmatter", () => {
  it("parses valid frontmatter", () => {
    const raw = `---\nname: prefers-bun\ndescription: Prefers bun over npm\ntype: feedback\n---\n\nUse bun for all package ops.`
    const result = parseFrontmatter(raw)
    expect(result).not.toBeNull()
    expect(result!.frontmatter.name).toBe("prefers-bun")
    expect(result!.frontmatter.description).toBe("Prefers bun over npm")
    expect(result!.frontmatter.type).toBe("feedback")
    expect(result!.body).toBe("Use bun for all package ops.")
  })

  it("returns null for missing frontmatter", () => {
    expect(parseFrontmatter("just some content")).toBeNull()
  })

  it("returns null for invalid type", () => {
    const raw = `---\nname: test\ndescription: test\ntype: invalid\n---\n\nbody`
    expect(parseFrontmatter(raw)).toBeNull()
  })

  it("returns null for missing required field", () => {
    const raw = `---\nname: test\ntype: user\n---\n\nbody`
    expect(parseFrontmatter(raw)).toBeNull()
  })

  it("trims body content", () => {
    const raw = `---\nname: test\ndescription: desc\ntype: user\n---\n\n\n  body content  \n`
    const result = parseFrontmatter(raw)
    expect(result!.body).toBe("body content")
  })
})

describe("serializeFrontmatter", () => {
  it("round-trips through parse", () => {
    const frontmatter = { name: "my-memory", description: "A test memory", type: "project" as const }
    const body = "Some project context."
    const serialized = serializeFrontmatter(frontmatter, body)
    const parsed = parseFrontmatter(serialized)
    expect(parsed).not.toBeNull()
    expect(parsed!.frontmatter).toEqual(frontmatter)
    expect(parsed!.body).toBe(body)
  })
})
