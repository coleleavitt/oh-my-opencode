import { existsSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import process from "node:process"

const DEFAULT_ANTHROPIC_ACTUAL_LIMIT = 200_000
const ANTHROPIC_ACCOUNTS_PATH = join(homedir(), ".config", "opencode", "anthropic-accounts.json")
const ACCOUNTS_CACHE_TTL_MS = 30_000

let accountsFileCache: { mtimeMs: number; checkedAt: number; anyContext1M: boolean } | null = null

function anyAccountHasContext1M(): boolean {
  if (process.env.OMO_SKIP_ANTHROPIC_ACCOUNTS_CHECK === "1") return false
  try {
    if (!existsSync(ANTHROPIC_ACCOUNTS_PATH)) return false
    const stat = statSync(ANTHROPIC_ACCOUNTS_PATH)
    const now = Date.now()
    if (accountsFileCache && accountsFileCache.mtimeMs === stat.mtimeMs && now - accountsFileCache.checkedAt < ACCOUNTS_CACHE_TTL_MS) {
      return accountsFileCache.anyContext1M
    }
    const raw = readFileSync(ANTHROPIC_ACCOUNTS_PATH, "utf8")
    const data = JSON.parse(raw) as { accounts?: Array<{ enabled?: boolean; capabilities?: { context1m?: boolean } }> }
    const anyContext1M = Array.isArray(data.accounts) && data.accounts.some((a) => a?.enabled !== false && a?.capabilities?.context1m === true)
    accountsFileCache = { mtimeMs: stat.mtimeMs, checkedAt: now, anyContext1M }
    return anyContext1M
  } catch {
    return false
  }
}

export type ContextLimitModelCacheState = {
  anthropicContext1MEnabled: boolean
  modelContextLimitsCache?: Map<string, number>
}

function isAnthropicProvider(providerID: string): boolean {
  const normalized = providerID.toLowerCase()
  return normalized === "anthropic" || normalized === "google-vertex-anthropic" || normalized === "aws-bedrock-anthropic"
}

function getAnthropicActualLimit(modelCacheState?: ContextLimitModelCacheState): number {
  // Priority: explicit config flag > env var override > plugin account state
  if (modelCacheState?.anthropicContext1MEnabled === true) return 1_000_000
  if (process.env.ANTHROPIC_1M_CONTEXT === "true" || process.env.VERTEX_ANTHROPIC_1M_CONTEXT === "true") return 1_000_000
  if (anyAccountHasContext1M()) return 1_000_000
  return DEFAULT_ANTHROPIC_ACTUAL_LIMIT
}

function supportsCachedAnthropicLimit(modelID: string): boolean {
  // Models eligible for cached 1M context: Opus 4.6-4.7, Sonnet 4.6+
  return /^claude-(opus-4[-.]([67])|sonnet-4[-.]([6-9]|\d{2,}))(\b|[-.])/i.test(modelID)
}

export function resolveActualContextLimit(
  providerID: string,
  modelID: string,
  modelCacheState?: ContextLimitModelCacheState,
): number | null {
  if (isAnthropicProvider(providerID)) {
    const explicit1M = getAnthropicActualLimit(modelCacheState)
    if (explicit1M === 1_000_000) return 1_000_000

    const cachedLimit = modelCacheState?.modelContextLimitsCache?.get(`${providerID}/${modelID}`)
    if (cachedLimit && supportsCachedAnthropicLimit(modelID)) return cachedLimit

    return DEFAULT_ANTHROPIC_ACTUAL_LIMIT
  }

  return modelCacheState?.modelContextLimitsCache?.get(`${providerID}/${modelID}`) ?? null
}
