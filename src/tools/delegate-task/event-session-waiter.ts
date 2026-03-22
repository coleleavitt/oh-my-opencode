import type { OpencodeClient } from "./types";
import { log } from "../../shared/logger";

interface WaitOptions {
  sessionID: string;
  directory: string;
  abort?: AbortSignal;
  onActivity?: () => void;
}

interface SessionStatusProps {
  sessionID?: string;
  sessionId?: string;
  status?: { type?: string };
}

interface SessionIdleProps {
  sessionID?: string;
  sessionId?: string;
}

interface EventWithSession {
  sessionID?: string;
  sessionId?: string;
  info?: { sessionID?: string; sessionId?: string };
}

function sid(props?: {
  sessionID?: string;
  sessionId?: string;
}): string | undefined {
  return props?.sessionID ?? props?.sessionId;
}

/**
 * Check session status directly via API as a fallback when SSE events
 * may be delayed or lost.
 */
async function checkSessionStatusDirect(
  client: OpencodeClient,
  sessionID: string,
): Promise<boolean> {
  try {
    const resp = await (client.session as any).status?.({})
    if (!resp?.data) return false
    const status = resp.data[sessionID]
    return !status || status.type === "idle"
  } catch {
    return false
  }
}

const STATUS_CHECK_INTERVAL_MS = 10_000

/**
 * Wait for session completion using SSE events instead of polling.
 * Falls back to periodic status checks if SSE events don't arrive.
 * Returns null on success, error string on abort or stream failure.
 */
export async function waitForSession(
  client: OpencodeClient,
  opts: WaitOptions,
): Promise<string | null> {
  const { sessionID, directory, abort, onActivity } = opts;

  log("[event-waiter] Starting SSE subscription", { sessionID, directory });

  let events: {
    stream: AsyncIterable<{ type?: string; properties?: unknown }>;
  };
  try {
    events = (await client.event.subscribe({
      query: { directory },
    })) as typeof events;
  } catch (error) {
    log("[event-waiter] SSE subscription failed, falling back to status polling", {
      sessionID,
      error: String(error),
    });
    // SSE failed — fall back to polling session status directly
    while (!abort?.aborted) {
      const idle = await checkSessionStatusDirect(client, sessionID)
      if (idle) {
        log("[event-waiter] Session idle via status poll fallback", { sessionID })
        return null
      }
      await new Promise(r => setTimeout(r, STATUS_CHECK_INTERVAL_MS))
    }
    return `Task aborted.\n\nSession ID: ${sessionID}`;
  }

  const stream = events.stream;
  let receivedIdle = false;

  // Start periodic status check as safety net for missed SSE events
  let statusCheckTimer: ReturnType<typeof setInterval> | undefined
  let resolvedViaStatusCheck = false
  const statusCheckPromise = new Promise<void>((resolve) => {
    statusCheckTimer = setInterval(async () => {
      const idle = await checkSessionStatusDirect(client, sessionID)
      if (idle) {
        log("[event-waiter] Session idle via periodic status check fallback", { sessionID })
        receivedIdle = true
        resolvedViaStatusCheck = true
        resolve()
      }
    }, STATUS_CHECK_INTERVAL_MS)
  })

  try {
    for await (const event of stream) {
      if (resolvedViaStatusCheck) {
        return null
      }
      if (abort?.aborted) {
        log("[event-waiter] Aborted", { sessionID });
        return `Task aborted.\n\nSession ID: ${sessionID}`;
      }

      if (!event?.type) continue;

      if (event.type === "session.idle") {
        const props = event.properties as SessionIdleProps | undefined;
        if (sid(props) === sessionID) {
          log("[event-waiter] Session idle detected", { sessionID });
          receivedIdle = true;
          return null;
        }
      }

      if (event.type === "session.status") {
        const props = event.properties as SessionStatusProps | undefined;
        if (sid(props) === sessionID) {
          if (props?.status?.type === "idle") {
            log("[event-waiter] Session status idle", { sessionID });
            receivedIdle = true;
            return null;
          }
          onActivity?.();
        }
      }

      // Track activity
      if (
        event.type === "message.updated" ||
        event.type === "message.part.updated" ||
        event.type === "tool.execute"
      ) {
        const props = event.properties as EventWithSession | undefined;
        const eventSid =
          sid(props) ?? props?.info?.sessionID ?? props?.info?.sessionId;
        if (eventSid === sessionID) onActivity?.();
      }
    }
  } catch (error) {
    log("[event-waiter] Stream error", { sessionID, error: String(error) });
    return `SSE stream error for session ${sessionID}: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    if (statusCheckTimer) clearInterval(statusCheckTimer)
    log("[event-waiter] Stream ended", { sessionID, receivedIdle });
  }

  // Stream ended without receiving session.idle - this is unexpected
  if (!receivedIdle) {
    log("[event-waiter] Stream ended without idle event", { sessionID });
    return `SSE stream ended unexpectedly without session.idle for ${sessionID}`;
  }

  return null;
}

function combine(a: AbortSignal, b: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const fn = () => ctrl.abort();
  a.addEventListener("abort", fn);
  b.addEventListener("abort", fn);
  if (a.aborted || b.aborted) ctrl.abort();
  return ctrl.signal;
}

/**
 * Wait for session with optional safety timeout.
 * Uses event-driven approach with fallback max wait time.
 */
export async function waitForSessionWithTimeout(
  client: OpencodeClient,
  opts: WaitOptions & { maxWaitMs?: number },
): Promise<string | null> {
  const { maxWaitMs, ...rest } = opts;
  const { sessionID } = rest;

  if (!maxWaitMs) return waitForSession(client, rest);

  const ctrl = new AbortController();
  const sig = rest.abort ? combine(rest.abort, ctrl.signal) : ctrl.signal;

  const timer = setTimeout(() => {
    log("[event-waiter] Safety timeout reached", { sessionID, maxWaitMs });
    ctrl.abort();
  }, maxWaitMs);

  try {
    const result = await waitForSession(client, { ...rest, abort: sig });
    if (ctrl.signal.aborted && !rest.abort?.aborted) {
      return `Event wait timeout after ${maxWaitMs}ms for session ${sessionID}`;
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
}
