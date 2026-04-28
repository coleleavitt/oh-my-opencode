import { existsSync } from "node:fs"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { log } from "../../shared/logger"

export async function saveMemoryEntry(params: {
  baseDir: string
  agentType: string
  content: string
}): Promise<string> {
  const { baseDir, agentType, content } = params
  await mkdir(baseDir, { recursive: true })
  const suffix = Math.random().toString(36).slice(2, 8)
  const filename = `${agentType}-${Date.now()}-${suffix}.md`
  const fullPath = join(baseDir, filename)
  await writeFile(fullPath, content, "utf8")
  log(`[auto-memory] saved: ${filename} — ${content.substring(0, 120)}`)
  return fullPath
}

export async function readMemoryFiles(baseDir: string): Promise<string[]> {
  if (!existsSync(baseDir)) return []
  const entries = await readdir(baseDir)
  const files: string[] = []
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue
    const full = join(baseDir, entry)
    try {
      const content = await readFile(full, "utf8")
      files.push(content)
    } catch {
      continue
    }
  }
  return files
}
