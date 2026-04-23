import type { OhMyOpenCodeConfig } from "../../config"
import type { PluginInput } from "@opencode-ai/plugin"
import { createFileWatcher } from "../../features/file-watcher"
import { log } from "../../shared/logger"

const HOOK_TAG = "[file-changed]"

export function createFileChangedHook(ctx: PluginInput, pluginConfig: OhMyOpenCodeConfig) {
  const config = pluginConfig.file_changed
  if (!config?.enabled) return {}

  const watchersBySession = new Map<string, ReturnType<typeof createFileWatcher>>()

  return {
    event: async ({ event }: { event: { type: string; properties?: unknown } }) => {
      const props = event.properties as { info?: { id?: string } } | undefined
      const sessionID = props?.info?.id
      if (!sessionID) return

      if (event.type === "session.created") {
        const watcher = createFileWatcher(sessionID, config.initial_paths, config.debounce_ms)
        watcher.on("change", (e) => {
          log(`${HOOK_TAG} File changed`, {
            sessionID: e.sessionID,
            filePath: e.filePath,
            event: e.event,
          })
        })
        watchersBySession.set(sessionID, watcher)
      } else if (event.type === "session.deleted") {
        const watcher = watchersBySession.get(sessionID)
        if (watcher) {
          watcher.close()
          watchersBySession.delete(sessionID)
        }
      }
    },
  }
}
