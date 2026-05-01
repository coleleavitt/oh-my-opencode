import { existsSync } from "node:fs"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { getMemoryDir } from "../memory/store"
import { log } from "../../shared/logger"

/**
 * Team shared memory — a `team/` subdirectory under the project's memory dir.
 * Teammates can read/write here for emergent coordination without explicit messaging.
 */

export function getTeamMemoryDir(cwd: string): string {
  return join(getMemoryDir(cwd), "team")
}

export async function ensureTeamMemoryDir(cwd: string): Promise<string> {
  const dir = getTeamMemoryDir(cwd)
  await mkdir(dir, { recursive: true })
  return dir
}

export async function writeTeamMemory(cwd: string, filename: string, content: string): Promise<string> {
  const dir = await ensureTeamMemoryDir(cwd)
  const safeName = filename.replace(/[^a-z0-9._-]/gi, "-").slice(0, 80)
  const fullPath = join(dir, safeName.endsWith(".md") ? safeName : `${safeName}.md`)
  await writeFile(fullPath, content, "utf8")
  log("[team-memory] wrote %s", fullPath)
  return fullPath
}

export async function readTeamMemories(cwd: string): Promise<Array<{ name: string; content: string }>> {
  const dir = getTeamMemoryDir(cwd)
  if (!existsSync(dir)) return []

  const entries = await readdir(dir)
  const results: Array<{ name: string; content: string }> = []

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue
    try {
      const content = await readFile(join(dir, entry), "utf8")
      results.push({ name: entry, content })
    } catch {
      continue
    }
  }

  return results
}

/**
 * Build a prompt fragment informing a teammate about the shared team memory directory.
 * Includes any existing team memories as context.
 */
export async function buildTeamMemoryContext(cwd: string): Promise<string> {
  const dir = await ensureTeamMemoryDir(cwd)
  const memories = await readTeamMemories(cwd)

  const memoryBlock = memories.length > 0
    ? memories.map((m) => `<team-memory name="${m.name}">\n${m.content}\n</team-memory>`).join("\n")
    : "(empty — no team memories yet)"

  return `<team-shared-memory dir="${dir}">
Team shared memory directory: ${dir}
Other teammates can read files you write here, and you can read theirs.
Use Read/Write tools to coordinate via this shared directory.

${memoryBlock}
</team-shared-memory>`
}
