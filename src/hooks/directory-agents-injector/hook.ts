import type { PluginInput } from "@opencode-ai/plugin";

import { createDynamicTruncator } from "../../shared/dynamic-truncator";
import { isReadOnlySubagent } from "../../shared/read-only-subagents";
import { getSessionAgent } from "../../features/claude-code-session-state";
import { processFilePathForAgentsInjection } from "./injector";
import { clearInjectedPaths } from "./storage";

interface ToolExecuteInput {
  tool: string;
  sessionID: string;
  callID: string;
}

interface ToolExecuteOutput {
  title: string;
  output: string;
  metadata: unknown;
}

interface ToolExecuteBeforeOutput {
  args: unknown;
}

interface EventInput {
  event: {
    type: string;
    properties?: unknown;
  };
}

export function createDirectoryAgentsInjectorHook(
  ctx: PluginInput,
  modelCacheState?: { anthropicContext1MEnabled: boolean },
  options?: { mdExcludes?: readonly string[] },
) {
  const sessionCaches = new Map<string, Set<string>>();
  const truncator = createDynamicTruncator(ctx, modelCacheState);

  const toolExecuteAfter = async (input: ToolExecuteInput, output: ToolExecuteOutput) => {
    const toolName = input.tool.toLowerCase();

    if (toolName === "read") {
      // Ported from cc119 `omitClaudeMd: true` pattern — read-only
      // research/review subagents don't benefit from project-context
      // injection, so skip it and save the tokens.
      if (isReadOnlySubagent(getSessionAgent(input.sessionID))) return;

      await processFilePathForAgentsInjection({
        ctx,
        truncator,
        sessionCaches,
        filePath: output.title,
        sessionID: input.sessionID,
        output,
        mdExcludes: options?.mdExcludes,
      });
      return;
    }
  };

  const toolExecuteBefore = async (
    input: ToolExecuteInput,
    output: ToolExecuteBeforeOutput,
  ): Promise<void> => {
    void input;
    void output;
  };

  const eventHandler = async ({ event }: EventInput) => {
    const props = event.properties as Record<string, unknown> | undefined;

    if (event.type === "session.deleted") {
      const sessionInfo = props?.info as { id?: string } | undefined;
      if (sessionInfo?.id) {
        sessionCaches.delete(sessionInfo.id);
        clearInjectedPaths(sessionInfo.id);
      }
    }

    if (event.type === "session.compacted") {
      const sessionID = (props?.sessionID ??
        (props?.info as { id?: string } | undefined)?.id) as string | undefined;
      if (sessionID) {
        sessionCaches.delete(sessionID);
        clearInjectedPaths(sessionID);
      }
    }
  };

  return {
    "tool.execute.before": toolExecuteBefore,
    "tool.execute.after": toolExecuteAfter,
    event: eventHandler,
  };
}
