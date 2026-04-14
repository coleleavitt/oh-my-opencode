import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { log } from "../../shared/logger"
import { parseFrontmatter, serializeFrontmatter } from "./parser"
import type { MemoryFile, MemoryType } from "./types"

const DEFAULT_MEMORY_BASE = path.join(os.homedir(), ".config", "opencode", "oh-my-opencode", "memory")

function getMemoryBase(): string {
  return process.env.OVERRIDE_MEMORY_BASE ?? DEFAULT_MEMORY_BASE
}

export function sanitizeCwd(cwd: string): string {
  return cwd
    .replace(/^\//, "")
    .replace(/\//g, "_")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "_")
    .slice(0, 200)
}

export function getMemoryDir(cwd: string): string {
  return path.join(getMemoryBase(), sanitizeCwd(cwd))
}

function toFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) + ".md"
}

export function saveMemory(
  cwd: string,
  name: string,
  description: string,
  type: MemoryType,
  content: string,
): string {
  const dir = getMemoryDir(cwd)
  fs.mkdirSync(dir, { recursive: true })

  const filename = toFilename(name)
  const filepath = path.join(dir, filename)
  const serialized = serializeFrontmatter({ name, description, type }, content)

  const tmp = filepath + ".tmp"
  fs.writeFileSync(tmp, serialized, "utf8")
  fs.renameSync(tmp, filepath)

  log(`[memory] saved ${filename} (type=${type}) in ${dir}`)
  return filename
}

export function deleteMemory(cwd: string, filename: string): boolean {
  const filepath = path.join(getMemoryDir(cwd), path.basename(filename))
  if (!fs.existsSync(filepath)) return false
  fs.unlinkSync(filepath)
  log(`[memory] deleted ${filename}`)
  return true
}

export function listMemories(cwd: string): MemoryFile[] {
  const dir = getMemoryDir(cwd)
  if (!fs.existsSync(dir)) return []

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"))
  const memories: MemoryFile[] = []

  for (const filename of files) {
    const filepath = path.join(dir, filename)
    try {
      const raw = fs.readFileSync(filepath, "utf8")
      const parsed = parseFrontmatter(raw)
      if (!parsed) continue
      memories.push({
        filename,
        filepath,
        name: parsed.frontmatter.name,
        description: parsed.frontmatter.description,
        type: parsed.frontmatter.type,
        content: parsed.body,
      })
    } catch {
      log(`[memory] failed to parse ${filename}, skipping`)
    }
  }

  return memories
}

export function loadMemories(cwd: string): string {
  const memories = listMemories(cwd)
  if (memories.length === 0) return ""

  const blocks = memories.map(
    (m) => `<memory name="${m.name}" type="${m.type}" description="${m.description}">\n${m.content}\n</memory>`,
  )
  return `<memories>\n${blocks.join("\n")}\n</memories>`
}
