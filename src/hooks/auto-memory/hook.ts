import type { OhMyOpenCodeConfig } from "../../config"
import type { PluginContext } from "../../plugin/types"
import { resolveMemoryBaseDir } from "../../features/auto-memory/paths"
import { runAutoDream } from "../../features/auto-memory/auto-dream"
import { log } from "../../shared/logger"

const HOOK_TAG = "[auto-memory-hook]"

export function createAutoMemoryHook(
  ctx: PluginContext,
  pluginConfig: OhMyOpenCodeConfig,
) {
  const config = pluginConfig.auto_memory
  if (!config?.enabled) return { event: undefined }

  return {
    event: async (input: {
      event: { type: string; properties?: unknown }
    }) => {
      if (input.event.type !== "session.idle") return
      if (!config.auto_dream.enabled) return

      const agentTypes = ["sisyphus", "code-reviewer", "oracle"]
      for (const agentType of agentTypes) {
        const baseDir = resolveMemoryBaseDir({
          scope: "project",
          agentType,
          projectDir: ctx.directory,
          configuredDir: config.directory,
        })
        const result = await runAutoDream({
          baseDir,
          consolidationThreshold: config.auto_dream.consolidation_threshold,
          maxMemoryChars: config.auto_dream.max_memory_chars,
        })
        if (result.consolidated) {
          log(`${HOOK_TAG} Memory consolidated`, { agentType, ...result })
        }
      }
    },
  }
}
