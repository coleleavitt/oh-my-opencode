import type { ToolContextWithMetadata, OpencodeClient } from "./types";
import type { SessionMessage } from "./executor-types";
import { getDefaultSyncPollTimeoutMs } from "./timing";
import { log } from "../../shared/logger";
import { waitForSessionWithTimeout } from "./event-session-waiter";

const NON_TERMINAL_FINISH_REASONS = new Set(["tool-calls", "unknown"]);

export function isSessionComplete(messages: SessionMessage[]): boolean {
  let lastUser: SessionMessage | undefined;
  let lastAssistant: SessionMessage | undefined;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!lastAssistant && msg.info?.role === "assistant") lastAssistant = msg;
    if (!lastUser && msg.info?.role === "user") lastUser = msg;
    if (lastUser && lastAssistant) break;
  }

  if (!lastAssistant?.info?.finish) return false;
  if (NON_TERMINAL_FINISH_REASONS.has(lastAssistant.info.finish)) return false;
  if (!lastUser?.info?.id || !lastAssistant?.info?.id) return false;
  return lastUser.info.id < lastAssistant.info.id;
}

/**
 * Wait for sync session completion using SSE events.
 * Falls back to safety timeout if events don't fire.
 */
export async function pollSyncSession(
  ctx: ToolContextWithMetadata,
  client: OpencodeClient,
  input: {
    sessionID: string;
    agentToUse: string;
    toastManager: { removeTask: (id: string) => void } | null | undefined;
    taskId: string | undefined;
    anchorMessageCount?: number;
    directory?: string;
  },
  timeoutMs?: number,
): Promise<string | null> {
  const maxWaitMs = Math.max(timeoutMs ?? getDefaultSyncPollTimeoutMs(), 50);
  const dir = input.directory ?? process.cwd();

  log("[task] Starting event-driven wait", {
    sessionID: input.sessionID,
    agentToUse: input.agentToUse,
  });

  const result = await waitForSessionWithTimeout(client, {
    sessionID: input.sessionID,
    directory: dir,
    abort: ctx.abort,
    maxWaitMs,
    onActivity: () => {
      log("[task] Activity detected", { sessionID: input.sessionID });
    },
  });

  if (result) {
    if (input.toastManager && input.taskId)
      input.toastManager.removeTask(input.taskId);
    return result;
  }

  log("[task] Session completed via events", { sessionID: input.sessionID });
  return null;
}
