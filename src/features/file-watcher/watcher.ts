import { watch, existsSync, type FSWatcher } from "node:fs"
import { EventEmitter } from "node:events"
import { log } from "../../shared/logger"

export type FileChangeEvent = {
  sessionID: string
  filePath: string
  event: "change" | "rename" | "delete"
}

export type FileWatcher = {
  addPath: (path: string) => void
  removePath: (path: string) => void
  close: () => void
  on: (event: "change", listener: (data: FileChangeEvent) => void) => void
}

const HOOK_TAG = "[file-watcher]"

type DebouncedHandler = {
  handler: (eventType: string, filename: string | null) => void
  cancel: () => void
}

function createDebouncedHandler(
  debounceMs: number,
  callback: (eventType: string, filename: string | null) => void,
): DebouncedHandler {
  const pending = new Map<string, ReturnType<typeof setTimeout>>()

  return {
    handler: (eventType: string, filename: string | null) => {
      const key = `${eventType}:${filename ?? ""}`
      const existing = pending.get(key)
      if (existing) clearTimeout(existing)

      pending.set(
        key,
        setTimeout(() => {
          pending.delete(key)
          callback(eventType, filename)
        }, debounceMs),
      )
    },
    cancel: () => {
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    },
  }
}

function mapFsEventType(eventType: string, filePath: string): FileChangeEvent["event"] {
  if (eventType === "rename") {
    return existsSync(filePath) ? "rename" : "delete"
  }
  return "change"
}

type WatcherEntry = { fsWatcher: FSWatcher; debounce: DebouncedHandler }

export function createFileWatcher(
  sessionID: string,
  initialPaths: string[],
  debounceMs = 100,
): FileWatcher {
  const emitter = new EventEmitter()
  const watchers = new Map<string, WatcherEntry>()

  const startWatching = (path: string): void => {
    if (watchers.has(path)) return

    try {
      const debounce = createDebouncedHandler(
        debounceMs,
        (eventType, filename) => {
          const resolvedPath = filename ? `${path}/${filename}` : path
          const changeEvent: FileChangeEvent = {
            sessionID,
            filePath: resolvedPath,
            event: mapFsEventType(eventType, resolvedPath),
          }
          emitter.emit("change", changeEvent)
        },
      )

      const fsWatcher = watch(path, { recursive: false }, (eventType, filename) => {
        debounce.handler(eventType, filename)
      })

      fsWatcher.on("error", (error) => {
        log(`${HOOK_TAG} Watcher error for ${path}`, { error })
      })

      watchers.set(path, { fsWatcher, debounce })
    } catch (error) {
      log(`${HOOK_TAG} Failed to watch ${path}`, { error })
    }
  }

  for (const path of initialPaths) {
    startWatching(path)
  }

  return {
    addPath: (path: string) => startWatching(path),
    removePath: (path: string) => {
      const entry = watchers.get(path)
      if (entry) {
        entry.debounce.cancel()
        entry.fsWatcher.close()
        watchers.delete(path)
      }
    },
    close: () => {
      for (const [, entry] of watchers) {
        entry.debounce.cancel()
        entry.fsWatcher.close()
      }
      watchers.clear()
    },
    on: (event: "change", listener: (data: FileChangeEvent) => void) => {
      emitter.on(event, listener)
    },
  }
}
