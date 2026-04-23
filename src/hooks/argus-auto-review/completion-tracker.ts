interface CompletionTrackerState {
  taskCompletionCount: number;
  lastVerifyAt: number;
}

const sessions = new Map<string, CompletionTrackerState>();

export function recordTaskCompletion(
  sessionID: string,
  threshold: number,
  now: number = Date.now(),
): { shouldVerify: boolean; taskCount: number } {
  // given: a task just completed in this session
  let state = sessions.get(sessionID);
  if (!state) {
    state = { taskCompletionCount: 0, lastVerifyAt: 0 };
    sessions.set(sessionID, state);
  }
  state.taskCompletionCount++;

  // when: threshold is 0 (disabled)
  if (threshold === 0) {
    return { shouldVerify: false, taskCount: state.taskCompletionCount };
  }

  // when: count has not reached threshold
  if (state.taskCompletionCount < threshold) {
    return { shouldVerify: false, taskCount: state.taskCompletionCount };
  }

  // then: fire verification and reset counter
  state.taskCompletionCount = 0;
  state.lastVerifyAt = now;
  return { shouldVerify: true, taskCount: threshold };
}

export function clearCompletionState(sessionID: string): void {
  sessions.delete(sessionID);
}

export function _resetAllCompletionStates(): void {
  sessions.clear();
}
