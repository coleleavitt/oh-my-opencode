import * as path from "node:path"
import * as os from "node:os"

const cwdBySession = new Map<string, string>()
const previousCwdBySession = new Map<string, string>()

const SUBSHELL_PATTERN = /\((?:[^()]*|\((?:[^()]*|\([^()]*\))*\))*\)/g
const CD_COMMAND_PATTERN = /(?:^|&&|;)\s*cd(?:\s+("(?:[^"\\]|\\.)*"|'[^']*'|[^\s;&|)]+))?(?=\s*$|\s*[;&|]|\s)/g

export function parseCdTarget(command: string, currentCwd: string): string | null {
  const stripped = command.replace(SUBSHELL_PATTERN, "")

  let lastTarget: string | null = null
  let match: RegExpExecArray | null

  CD_COMMAND_PATTERN.lastIndex = 0
  while ((match = CD_COMMAND_PATTERN.exec(stripped)) !== null) {
    const rawArg = match[1]?.trim()

    if (!rawArg) {
      lastTarget = os.homedir()
      continue
    }

    if (rawArg === "-") {
      lastTarget = "-"
      continue
    }

    let unquoted = rawArg
    if (
      (unquoted.startsWith('"') && unquoted.endsWith('"')) ||
      (unquoted.startsWith("'") && unquoted.endsWith("'"))
    ) {
      unquoted = unquoted.slice(1, -1)
    }

    if (unquoted.startsWith("~")) {
      unquoted = path.join(os.homedir(), unquoted.slice(1).replace(/^\//, ""))
    }

    if (path.isAbsolute(unquoted)) {
      lastTarget = unquoted
    } else {
      const base = lastTarget && lastTarget !== "-" ? lastTarget : currentCwd
      lastTarget = path.resolve(base, unquoted)
    }
  }

  return lastTarget
}

export function recordCwdChange(
  sessionID: string,
  command: string,
  parentCwd: string,
): { changed: boolean; oldCwd?: string; newCwd?: string } {
  const currentCwd = cwdBySession.get(sessionID) ?? parentCwd
  const target = parseCdTarget(command, currentCwd)

  if (!target) {
    return { changed: false }
  }

  let resolvedTarget = target
  if (target === "-") {
    const prev = previousCwdBySession.get(sessionID)
    if (!prev) return { changed: false }
    resolvedTarget = prev
  }

  if (resolvedTarget === currentCwd) {
    return { changed: false }
  }

  previousCwdBySession.set(sessionID, currentCwd)
  cwdBySession.set(sessionID, resolvedTarget)

  return { changed: true, oldCwd: currentCwd, newCwd: resolvedTarget }
}

export function clearCwdState(sessionID: string): void {
  cwdBySession.delete(sessionID)
  previousCwdBySession.delete(sessionID)
}
