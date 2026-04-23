import type { ArgusAutoReviewState } from "./types";

interface EditThresholdCheckConfig {
  enabled: boolean;
  editThreshold: number;
  cooldownMs: number;
}

const sessionStates = new Map<string, ArgusAutoReviewState>();

function getOrCreateState(sessionID: string): ArgusAutoReviewState {
  let state = sessionStates.get(sessionID);
  if (!state) {
    state = { editCount: 0, lastReviewAt: 0 };
    sessionStates.set(sessionID, state);
  }
  return state;
}

export function recordEditAndCheck(
  sessionID: string,
  config: EditThresholdCheckConfig,
  now: number = Date.now(),
): { shouldFire: boolean; editCount: number } {
  const state = getOrCreateState(sessionID);
  state.editCount += 1;

  const cooldownActive =
    state.lastReviewAt > 0 && now - state.lastReviewAt < config.cooldownMs;
  if (state.editCount >= config.editThreshold && !cooldownActive) {
    const triggeredCount = state.editCount;
    state.editCount = 0;
    state.lastReviewAt = now;
    return { shouldFire: true, editCount: triggeredCount };
  }

  return { shouldFire: false, editCount: state.editCount };
}

export function clearSessionState(sessionID: string): void {
  sessionStates.delete(sessionID);
}

export function _resetAllSessionStates(): void {
  sessionStates.clear();
}
