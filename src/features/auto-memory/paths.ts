import { homedir } from "node:os"
import { isAbsolute, join } from "node:path"
import type { MemoryScope } from "../../config/schema/auto-memory"

export function resolveMemoryBaseDir(params: {
  scope: MemoryScope
  agentType: string
  projectDir: string
  configuredDir?: string
}): string {
  const { scope, agentType, projectDir, configuredDir } = params

  if (configuredDir) {
    const expanded = configuredDir.startsWith("~/")
      ? join(homedir(), configuredDir.slice(2))
      : configuredDir
    const resolved = isAbsolute(expanded) ? expanded : join(projectDir, expanded)
    return join(resolved, agentType)
  }

  switch (scope) {
    case "user":
      return join(homedir(), ".claude", "agent-memory", agentType)
    case "project":
      return join(projectDir, ".claude", "agent-memory", agentType)
    case "local":
      return join(projectDir, ".claude", "agent-memory-local", agentType)
  }
}
