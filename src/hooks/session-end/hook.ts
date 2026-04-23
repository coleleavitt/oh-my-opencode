import { log } from "../../shared/logger";
import { detectReason } from "./reason-detector";
import type { SessionEndConfig } from "./types";
import { DEFAULT_SESSION_END_CONFIG } from "./types";

const HOOK_TAG = "[session-end]";

export function createSessionEndHook(config: SessionEndConfig = DEFAULT_SESSION_END_CONFIG) {
  if (!config.enabled) return {};

  return {
    event: async ({ event }: { event: { type: string; properties?: unknown } }) => {
      if (event.type !== "session.deleted") return;
      const props = event.properties as { info?: { id?: string } } | undefined;
      const sessionID = props?.info?.id;
      if (!sessionID) return;
      const reason = detectReason(event);
      log(`${HOOK_TAG} Session ended`, {
        sessionID,
        reason,
        timestamp: Date.now(),
      });
    },
  };
}
