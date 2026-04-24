import { log, normalizeModelID } from "../../shared"

const OPUS_46_PATTERN = /claude-.*opus.*4[.\-]?6/i
const OPUS_47_PATTERN = /claude.*opus.*4[.\-]?7/i
const INTERNAL_SKIP_AGENTS = new Set(["title", "summary", "compaction"])

function isClaudeProvider(providerID: string, modelID: string): boolean {
  if (["anthropic", "google-vertex-anthropic"].includes(providerID)) return true
  if (providerID === "github-copilot" && modelID.toLowerCase().includes("claude")) return true
  return false
}

function isOpus46OrNewer(modelID: string): boolean {
  const normalized = normalizeModelID(modelID)
  return OPUS_46_PATTERN.test(normalized)
}

function isOpus47(modelID: string): boolean {
  const normalized = normalizeModelID(modelID)
  return OPUS_47_PATTERN.test(normalized)
}

function shouldSkipForInternalAgent(agentName: string | undefined): boolean {
  if (!agentName) return false
  return INTERNAL_SKIP_AGENTS.has(agentName.trim().toLowerCase())
}

interface ChatParamsInput {
  sessionID: string
  agent: { name?: string }
  model: { providerID: string; modelID: string }
  provider: { id: string }
  message: { variant?: string }
}

interface ChatParamsOutput {
  temperature?: number
  topP?: number
  topK?: number
  options: Record<string, unknown>
}

/**
 * Valid thinking budget levels per model tier.
 * Only Opus 4.6+ supports "max"; Opus 4.7+ supports "xhigh"; older models cap at "high".
 */
const MAX_VARIANT_BY_TIER: Record<string, string> = {
  opus46: "max",
  default: "high",
}

function clampVariant(variant: string, isOpus47: boolean, isOpus46OrNewer: boolean): string {
  if (variant === "xhigh") {
    return isOpus47 ? "xhigh" : isOpus46OrNewer ? "max" : "high"
  }
  if (variant !== "max") return variant
  return isOpus46OrNewer ? MAX_VARIANT_BY_TIER.opus46 : MAX_VARIANT_BY_TIER.default
}

export function createAnthropicEffortHook() {
  return {
    "chat.params": async (
      input: ChatParamsInput,
      output: ChatParamsOutput
    ): Promise<void> => {
      const { agent, model, message } = input
      if (!model?.modelID || !model?.providerID) return
      if (message.variant !== "max" && message.variant !== "xhigh") return
      if (!isClaudeProvider(model.providerID, model.modelID)) return
      if (shouldSkipForInternalAgent(agent?.name)) return
      if (output.options.effort !== undefined) return

      const opus47 = isOpus47(model.modelID)
      const opus46Plus = isOpus46OrNewer(model.modelID)
      const clamped = clampVariant(message.variant, opus47, opus46Plus)
      output.options.effort = clamped

      if (message.variant === "xhigh") {
        if (!opus47) {
          ;(message as { variant?: string }).variant = clamped
          log(`[anthropic-effort] xhigh variant clamped to ${clamped} on model ${model.modelID}`, {
            sessionID: input.sessionID,
            provider: model.providerID,
            model: model.modelID,
          })
        } else {
          log("anthropic-effort: injected effort=xhigh", {
            sessionID: input.sessionID,
            provider: model.providerID,
            model: model.modelID,
          })
        }
      } else if (message.variant === "max") {
        if (!opus46Plus) {
          ;(message as { variant?: string }).variant = clamped
          log("anthropic-effort: clamped variant max→high for non-Opus-4.6 model", {
            sessionID: input.sessionID,
            provider: model.providerID,
            model: model.modelID,
          })
        } else {
          log("anthropic-effort: injected effort=max", {
            sessionID: input.sessionID,
            provider: model.providerID,
            model: model.modelID,
          })
        }
      }
    },
  }
}
