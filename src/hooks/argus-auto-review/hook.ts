import type { PluginInput } from "@opencode-ai/plugin";

import type { OhMyOpenCodeConfig } from "../../config";
import { log } from "../../shared/logger";
import { clearCompletionState } from "./completion-tracker";
import { clearSessionState } from "./edit-threshold-detector";
import { resolveArgusAutoReviewConfig } from "./resolve-config";
import { handleEditTrackingAfter } from "./tool-execute-after-handler";
import { handlePreCommitReview } from "./tool-execute-before-handler";
import type { ArgusAutoReviewConfig } from "./types";

const HOOK_TAG = "[argus-auto-review]";

export function createArgusAutoReviewHook(
  ctx: PluginInput,
  pluginConfig: OhMyOpenCodeConfig,
) {
  const config: ArgusAutoReviewConfig = resolveArgusAutoReviewConfig(
    pluginConfig.argus_auto_review,
  );

  if (!config.enabled) {
    return {};
  }

  log(`${HOOK_TAG} Enabled`, {
    mode: config.mode,
    editThreshold: config.editThreshold,
    cooldownMs: config.cooldownMs,
    blockOnPLevels: config.blockOnPLevels,
    confidenceThreshold: config.confidenceThreshold,
    skill: config.skill,
  });

  const recentFilesBySession = new Map<string, string[]>();

  const preCommitEnabled =
    config.mode === "pre-commit" || config.mode === "hybrid";
  const editTrackingEnabled =
    config.mode === "n-edits" ||
    config.mode === "hybrid" ||
    config.mode === "post-tool-use";
  const taskVerificationEnabled = config.autoVerifyAfterNTasks > 0;
  const afterHandlerEnabled = editTrackingEnabled || taskVerificationEnabled;

  const preCommitHandler = async (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: Record<string, unknown> },
  ): Promise<void> => {
    await handlePreCommitReview({ ctx, input, output, config });
  };

  const editTrackingHandler = async (
    input: { tool: string; sessionID: string; callID: string },
    output: { title: string; output: string; metadata: Record<string, unknown> } | undefined,
  ): Promise<void> => {
    await handleEditTrackingAfter({
      ctx,
      input: {
        tool: input.tool,
        sessionID: input.sessionID,
        callID: input.callID,
        args: undefined,
      },
      output: output
        ? { output: output.output, metadata: output.metadata }
        : {},
      config,
      recentFilesBySession,
    });
  };

  const eventHandler = async ({
    event,
  }: {
    event: { type: string; properties?: unknown };
  }): Promise<void> => {
    if (event.type !== "session.deleted") return;
    const props = event.properties as { info?: { id?: string } } | undefined;
    const id = props?.info?.id;
    if (typeof id === "string") {
      clearSessionState(id);
      clearCompletionState(id);
      recentFilesBySession.delete(id);
    }
  };

  return {
    event: eventHandler,
    "tool.execute.before": preCommitEnabled ? preCommitHandler : undefined,
    "tool.execute.after": afterHandlerEnabled ? editTrackingHandler : undefined,
  };
}
