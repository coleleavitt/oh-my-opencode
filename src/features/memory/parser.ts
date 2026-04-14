import { MemoryFrontmatterSchema, type MemoryFrontmatter } from "./types"

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/

function parseSimpleYaml(yaml: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of yaml.split("\n")) {
    const colonIdx = line.indexOf(":")
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "")
    if (key) result[key] = value
  }
  return result
}

export function parseFrontmatter(raw: string): { frontmatter: MemoryFrontmatter; body: string } | null {
  const match = FRONTMATTER_REGEX.exec(raw)
  if (!match) return null

  const yamlBlock = match[1]
  const body = match[2].trim()

  const parsed = parseSimpleYaml(yamlBlock)
  const result = MemoryFrontmatterSchema.safeParse(parsed)
  if (!result.success) return null

  return { frontmatter: result.data, body }
}

export function serializeFrontmatter(frontmatter: MemoryFrontmatter, body: string): string {
  return `---\nname: ${frontmatter.name}\ndescription: ${frontmatter.description}\ntype: ${frontmatter.type}\n---\n\n${body}\n`
}
