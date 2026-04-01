// Prompt cache latch: once a feature is activated in a session,
// it stays on for the rest of that session. Prevents mid-session
// header/option changes from busting the prompt cache (50-70K tokens wasted per flip).
const latches = new Map<string, Map<string, unknown>>();

function session(id: string): Map<string, unknown> {
  let s = latches.get(id);
  if (!s) {
    s = new Map();
    latches.set(id, s);
  }
  return s;
}

export function latch<T>(
  sessionID: string,
  key: string,
  value: T | undefined,
): T | undefined {
  const s = session(sessionID);
  if (value !== undefined) {
    s.set(key, value);
    return value;
  }
  return s.get(key) as T | undefined;
}

export function clear(sessionID: string): void {
  latches.delete(sessionID);
}
