import { log } from "./logger";

const HIGH_THRESHOLD = 1.5 * 1024 * 1024 * 1024;
const CRITICAL_THRESHOLD = 2.5 * 1024 * 1024 * 1024;
const POLL_MS = 30_000;

export type MemoryStatus = "normal" | "high" | "critical";

let timer: ReturnType<typeof setInterval> | null = null;
let last: MemoryStatus = "normal";

function check(): MemoryStatus {
  const heap = process.memoryUsage().heapUsed;
  if (heap >= CRITICAL_THRESHOLD) return "critical";
  if (heap >= HIGH_THRESHOLD) return "high";
  return "normal";
}

export function startMemoryMonitor(
  onWarning?: (status: MemoryStatus, heap: number) => void,
): () => void {
  if (timer) return () => stopMemoryMonitor();

  timer = setInterval(() => {
    const status = check();
    if (status !== "normal" && status !== last) {
      const heap = process.memoryUsage().heapUsed;
      const mb = Math.round(heap / (1024 * 1024));
      log(`memory ${status}: ${mb}MB heap`, { status, mb });
      onWarning?.(status, heap);
    }
    last = status;
  }, POLL_MS);

  if (timer && "unref" in timer) {
    (timer as NodeJS.Timeout).unref();
  }

  return () => stopMemoryMonitor();
}

export function stopMemoryMonitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  last = "normal";
}
