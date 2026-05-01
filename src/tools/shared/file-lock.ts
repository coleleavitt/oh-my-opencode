import path from "path"
import { Semaphore } from "./semaphore"

const locks = new Map<string, Semaphore>()

function get(filePath: string) {
  const resolved = path.resolve(filePath)
  const hit = locks.get(resolved)
  if (hit) return hit
  const next = new Semaphore(1)
  locks.set(resolved, next)
  return next
}

export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const sem = get(filePath)
  await sem.acquire()
  try {
    return await fn()
  } finally {
    sem.release()
  }
}
