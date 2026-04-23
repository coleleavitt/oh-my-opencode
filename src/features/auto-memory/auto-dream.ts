import { readMemoryFiles } from "./memory-store"
import { log } from "../../shared/logger"

const HOOK_TAG = "[auto-dream]"

export interface AutoDreamResult {
  consolidated: boolean
  reason: string
  beforeChars: number
  afterChars?: number
}

export async function runAutoDream(params: {
  baseDir: string
  consolidationThreshold: number
  maxMemoryChars: number
}): Promise<AutoDreamResult> {
  const { baseDir, consolidationThreshold, maxMemoryChars } = params
  const files = await readMemoryFiles(baseDir)
  const totalChars = files.reduce((sum, f) => sum + f.length, 0)

  if (files.length < consolidationThreshold) {
    return {
      consolidated: false,
      reason: `file count ${files.length} below threshold ${consolidationThreshold}`,
      beforeChars: totalChars,
    }
  }
  if (totalChars < maxMemoryChars) {
    return {
      consolidated: false,
      reason: `total ${totalChars} chars below max ${maxMemoryChars}`,
      beforeChars: totalChars,
    }
  }

  log(`${HOOK_TAG} Would consolidate memory (stub)`, {
    baseDir,
    fileCount: files.length,
    totalChars,
  })

  return {
    consolidated: false,
    reason: "consolidation not yet implemented (stub)",
    beforeChars: totalChars,
  }
}
