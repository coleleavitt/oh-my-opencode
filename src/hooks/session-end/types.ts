export type SessionEndReason = "user_quit" | "error" | "context_limit" | "bypass_permissions_disabled" | "unknown";

export interface SessionEndEvent {
  sessionID: string;
  reason: SessionEndReason;
  timestamp: number;
}

export interface SessionEndConfig {
  enabled: boolean;
}

export const DEFAULT_SESSION_END_CONFIG: SessionEndConfig = {
  enabled: true,
};
