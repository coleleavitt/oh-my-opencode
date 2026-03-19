declare const require: (name: string) => any;
const { describe, test, expect, beforeEach, afterEach } = require("bun:test");
import { __setTimingConfig, __resetTimingConfig } from "./timing";

function createMockCtx(aborted = false) {
  const controller = new AbortController();
  if (aborted) controller.abort();
  return {
    sessionID: "parent-session",
    messageID: "parent-message",
    agent: "test-agent",
    abort: controller.signal,
  };
}

async function* createMockEventStream(
  sessionID: string,
  events: Array<{ type: string; delay?: number }>,
): AsyncGenerator<{ type: string; properties: unknown }> {
  for (const evt of events) {
    if (evt.delay) await new Promise((r) => setTimeout(r, evt.delay));
    if (evt.type === "session.idle") {
      yield { type: "session.idle", properties: { sessionID } };
    } else if (evt.type === "session.status.idle") {
      yield {
        type: "session.status",
        properties: { sessionID, status: { type: "idle" } },
      };
    } else if (evt.type === "session.status.busy") {
      yield {
        type: "session.status",
        properties: { sessionID, status: { type: "busy" } },
      };
    } else if (evt.type === "message.updated") {
      yield { type: "message.updated", properties: { sessionID } };
    }
  }
}

function createMockClient(
  sessionID: string,
  events: Array<{ type: string; delay?: number }>,
) {
  return {
    event: {
      subscribe: async () => ({
        stream: createMockEventStream(sessionID, events),
      }),
    },
    session: {
      abort: async () => {},
      messages: async () => ({ data: [] }),
      status: async () => ({ data: {} }),
    },
  };
}

describe("pollSyncSession", () => {
  beforeEach(() => {
    __setTimingConfig({
      POLL_INTERVAL_MS: 10,
      MIN_STABILITY_TIME_MS: 0,
      STABILITY_POLLS_REQUIRED: 1,
      MAX_POLL_TIME_MS: 5000,
    });
  });

  afterEach(() => {
    __resetTimingConfig();
  });

  describe("event-driven completion", () => {
    test("completes when session.idle event is received", async () => {
      //#given - SSE stream that emits session.idle
      const { pollSyncSession } = require("./sync-session-poller");
      const mockClient = createMockClient("ses_test", [
        { type: "session.idle" },
      ]);

      //#when
      const result = await pollSyncSession(createMockCtx(), mockClient, {
        sessionID: "ses_test",
        agentToUse: "test-agent",
        toastManager: null,
        taskId: undefined,
      });

      //#then - should return null (success)
      expect(result).toBeNull();
    });

    test("completes when session.status with type idle is received", async () => {
      //#given - SSE stream that emits session.status with idle type
      const { pollSyncSession } = require("./sync-session-poller");
      const mockClient = createMockClient("ses_test", [
        { type: "session.status.busy" },
        { type: "session.status.idle" },
      ]);

      //#when
      const result = await pollSyncSession(createMockCtx(), mockClient, {
        sessionID: "ses_test",
        agentToUse: "test-agent",
        toastManager: null,
        taskId: undefined,
      });

      //#then
      expect(result).toBeNull();
    });

    test("ignores events for different sessions", async () => {
      //#given - SSE stream with events for wrong session, then correct session
      const { pollSyncSession } = require("./sync-session-poller");

      async function* stream(): AsyncGenerator<{
        type: string;
        properties: unknown;
      }> {
        yield {
          type: "session.idle",
          properties: { sessionID: "other_session" },
        };
        yield { type: "session.idle", properties: { sessionID: "ses_test" } };
      }

      const mockClient = {
        event: { subscribe: async () => ({ stream: stream() }) },
        session: {
          abort: async () => {},
          messages: async () => ({ data: [] }),
          status: async () => ({ data: {} }),
        },
      };

      //#when
      const result = await pollSyncSession(createMockCtx(), mockClient, {
        sessionID: "ses_test",
        agentToUse: "test-agent",
        toastManager: null,
        taskId: undefined,
      });

      //#then
      expect(result).toBeNull();
    });
  });

  describe("abort handling", () => {
    test("returns abort message when signal is aborted before stream", async () => {
      //#given - context already aborted
      const { pollSyncSession } = require("./sync-session-poller");

      async function* stream(): AsyncGenerator<{
        type: string;
        properties: unknown;
      }> {
        yield {
          type: "message.updated",
          properties: { sessionID: "ses_abort" },
        };
      }

      const mockClient = {
        event: { subscribe: async () => ({ stream: stream() }) },
        session: {
          abort: async () => {},
          messages: async () => ({ data: [] }),
          status: async () => ({ data: {} }),
        },
      };

      //#when
      const result = await pollSyncSession(createMockCtx(true), mockClient, {
        sessionID: "ses_abort",
        agentToUse: "test-agent",
        toastManager: { removeTask: () => {} },
        taskId: "task_123",
      });

      //#then
      expect(result).toContain("Task aborted");
      expect(result).toContain("ses_abort");
    });
  });

  describe("timeout handling", () => {
    test("returns timeout error when maxWaitMs exceeded", async () => {
      //#given - stream that never emits idle
      const { pollSyncSession } = require("./sync-session-poller");

      async function* slowStream(): AsyncGenerator<{
        type: string;
        properties: unknown;
      }> {
        await new Promise((r) => setTimeout(r, 200));
        yield {
          type: "session.idle",
          properties: { sessionID: "ses_timeout" },
        };
      }

      const mockClient = {
        event: { subscribe: async () => ({ stream: slowStream() }) },
        session: {
          abort: async () => {},
          messages: async () => ({ data: [] }),
          status: async () => ({ data: {} }),
        },
      };

      //#when - use very short timeout
      const result = await pollSyncSession(
        createMockCtx(),
        mockClient,
        {
          sessionID: "ses_timeout",
          agentToUse: "test-agent",
          toastManager: null,
          taskId: undefined,
        },
        50,
      );

      //#then - should return timeout error
      expect(result).toContain("timeout");
      expect(result).toContain("ses_timeout");
    });
  });

  describe("SSE subscription failure", () => {
    test("returns error when event.subscribe throws", async () => {
      //#given - client that throws on subscribe
      const { pollSyncSession } = require("./sync-session-poller");

      const mockClient = {
        event: {
          subscribe: async () => {
            throw new Error("Connection refused");
          },
        },
        session: {
          abort: async () => {},
          messages: async () => ({ data: [] }),
          status: async () => ({ data: {} }),
        },
      };

      //#when
      const result = await pollSyncSession(createMockCtx(), mockClient, {
        sessionID: "ses_fail",
        agentToUse: "test-agent",
        toastManager: null,
        taskId: undefined,
      });

      //#then - should return error string
      expect(result).toContain("SSE subscription failed");
      expect(result).toContain("Connection refused");
    });
  });

  describe("stream ending unexpectedly", () => {
    test("returns error when stream ends without idle event", async () => {
      //#given - stream that ends without emitting idle
      const { pollSyncSession } = require("./sync-session-poller");

      async function* emptyStream(): AsyncGenerator<{
        type: string;
        properties: unknown;
      }> {
        yield {
          type: "message.updated",
          properties: { sessionID: "ses_empty" },
        };
      }

      const mockClient = {
        event: { subscribe: async () => ({ stream: emptyStream() }) },
        session: {
          abort: async () => {},
          messages: async () => ({ data: [] }),
          status: async () => ({ data: {} }),
        },
      };

      //#when
      const result = await pollSyncSession(createMockCtx(), mockClient, {
        sessionID: "ses_empty",
        agentToUse: "test-agent",
        toastManager: null,
        taskId: undefined,
      });

      //#then - should return error about unexpected stream end
      expect(result).toContain("SSE stream ended unexpectedly");
      expect(result).toContain("ses_empty");
    });
  });

  describe("isSessionComplete edge cases", () => {
    test("returns false when messages array is empty", () => {
      const { isSessionComplete } = require("./sync-session-poller");
      const messages: any[] = [];
      const result = isSessionComplete(messages);
      expect(result).toBe(false);
    });

    test("returns false when no assistant message exists", () => {
      const { isSessionComplete } = require("./sync-session-poller");
      const messages = [
        { info: { id: "msg_001", role: "user", time: { created: 1000 } } },
        { info: { id: "msg_002", role: "user", time: { created: 2000 } } },
      ];
      const result = isSessionComplete(messages);
      expect(result).toBe(false);
    });

    test("returns false when only assistant message exists (no user)", () => {
      const { isSessionComplete } = require("./sync-session-poller");
      const messages = [
        {
          info: {
            id: "msg_001",
            role: "assistant",
            time: { created: 1000 },
            finish: "end_turn",
          },
          parts: [{ type: "text", text: "Response" }],
        },
      ];
      const result = isSessionComplete(messages);
      expect(result).toBe(false);
    });

    test("returns true when assistant finished after user with terminal finish", () => {
      const { isSessionComplete } = require("./sync-session-poller");
      const messages = [
        { info: { id: "msg_001", role: "user", time: { created: 1000 } } },
        {
          info: {
            id: "msg_002",
            role: "assistant",
            time: { created: 2000 },
            finish: "stop",
          },
          parts: [{ type: "text", text: "Done" }],
        },
      ];
      const result = isSessionComplete(messages);
      expect(result).toBe(true);
    });

    test("returns false when assistant finish is tool-calls (non-terminal)", () => {
      const { isSessionComplete } = require("./sync-session-poller");
      const messages = [
        { info: { id: "msg_001", role: "user", time: { created: 1000 } } },
        {
          info: {
            id: "msg_002",
            role: "assistant",
            time: { created: 2000 },
            finish: "tool-calls",
          },
          parts: [{ type: "tool-call" }],
        },
      ];
      const result = isSessionComplete(messages);
      expect(result).toBe(false);
    });
  });
});
