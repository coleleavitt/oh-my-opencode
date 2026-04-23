import type { SessionEndReason } from "./types";

export function detectReason(event: {
  type: string;
  properties?: unknown;
}): SessionEndReason {
  if (event.type !== "session.deleted") return "unknown";
  const props = event.properties as {
    info?: { error?: unknown; reason?: string };
  } | undefined;
  const reason = props?.info?.reason;
  if (typeof reason === "string") {
    if (reason.includes("quit") || reason.includes("user")) return "user_quit";
    if (reason.includes("context")) return "context_limit";
    if (reason.includes("permission") || reason.includes("bypass")) return "bypass_permissions_disabled";
  }
  if (props?.info?.error) return "error";
  return "unknown";
}
