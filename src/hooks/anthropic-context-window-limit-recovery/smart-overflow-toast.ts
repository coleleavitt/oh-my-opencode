export interface OverflowClassification {
  kind: "200k-overflow" | "1m-overflow" | "unknown"
  message: string
}

export function classifyOverflow(parsed: { currentTokens: number; maxTokens: number }): OverflowClassification {
  if (parsed.maxTokens < 500_000) {
    return {
      kind: "200k-overflow",
      message: `Context overflowed on a 200K-capable account (${parsed.currentTokens.toLocaleString()} tokens > ${parsed.maxTokens.toLocaleString()} max). The auth plugin auto-routes requests >180K to 1M-capable accounts when available. Check your anthropic-accounts.json for accounts with capabilities.context1m=true.`,
    }
  }
  if (parsed.maxTokens >= 500_000) {
    return {
      kind: "1m-overflow",
      message: `Genuine 1M context overflow (${parsed.currentTokens.toLocaleString()} tokens). Compaction will run.`,
    }
  }
  return { kind: "unknown", message: `Unexpected overflow: ${parsed.currentTokens} tokens > ${parsed.maxTokens} max` }
}

const DEDUP_INTERVAL_MS = 5 * 60 * 1000

export function shouldEmitToast(
  state: Map<string, number>,
  providerID: string,
  modelID: string,
): boolean {
  const key = `${providerID}:${modelID}`
  const lastEmit = state.get(key) ?? 0
  const now = Date.now()
  if (now - lastEmit < DEDUP_INTERVAL_MS) return false
  state.set(key, now)
  return true
}
