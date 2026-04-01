import { log } from "../../shared/logger";

export type ModelCost = {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
  cost: number;
  calls: number;
};

export type SessionCost = {
  models: Map<string, ModelCost>;
  total: number;
};

const sessions = new Map<string, SessionCost>();

function ensure(sessionID: string): SessionCost {
  let s = sessions.get(sessionID);
  if (!s) {
    s = { models: new Map(), total: 0 };
    sessions.set(sessionID, s);
  }
  return s;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function getSessionCost(sessionID: string): SessionCost | undefined {
  return sessions.get(sessionID);
}

export function createCostTrackerHook() {
  return {
    event: async ({
      event,
    }: {
      event: { type: string; properties?: unknown };
    }) => {
      if (event.type === "message.updated") {
        const props = event.properties as { info?: unknown } | undefined;
        const info = props?.info;
        if (!isRecord(info)) return;
        if (info.role !== "assistant") return;

        const sessionID = info.sessionID as string | undefined;
        const modelID = info.modelID as string | undefined;
        if (!sessionID || !modelID) return;

        const tokens = info.tokens as
          | {
              input?: number;
              output?: number;
              reasoning?: number;
              cache?: { read?: number; write?: number };
            }
          | undefined;
        if (!tokens) return;

        const cost = typeof info.cost === "number" ? info.cost : 0;
        const session = ensure(sessionID);

        const prev = session.models.get(modelID);
        const entry: ModelCost = {
          input: tokens.input ?? 0,
          output: tokens.output ?? 0,
          reasoning: tokens.reasoning ?? 0,
          cache: {
            read: tokens.cache?.read ?? 0,
            write: tokens.cache?.write ?? 0,
          },
          cost,
          calls: (prev?.calls ?? 0) + 1,
        };
        session.models.set(modelID, entry);

        let total = 0;
        for (const m of session.models.values()) total += m.cost;
        session.total = total;
      }

      if (event.type === "session.deleted") {
        const props = event.properties as
          | { info?: { id?: string } }
          | undefined;
        const id = props?.info?.id;
        if (id) {
          const s = sessions.get(id);
          if (s) {
            log("[cost-tracker] session ended", {
              sessionID: id,
              total: s.total.toFixed(4),
              models: s.models.size,
            });
          }
          sessions.delete(id);
        }
      }
    },
  };
}
