import type { PluginInput } from "@opencode-ai/plugin";

import { log } from "../../shared/logger";
import { detectGitCommit } from "./pre-commit-detector";
import {
  filterByConfidence,
  formatBlockMessage,
  shouldBlock,
} from "./p-level-parser";
import { invokeArgusReviewSync } from "./review-invoker-sync";
import { readStagedDiff } from "./staged-diff-reader";
import type { ArgusAutoReviewConfig } from "./types";

const HOOK_TAG = "[argus-auto-review:pre-commit]";

export interface ToolExecuteBeforeInput {
  tool: string;
  sessionID: string;
  callID: string;
}

export interface ToolExecuteBeforeOutput {
  args: Record<string, unknown>;
}

export async function handlePreCommitReview(params: {
  ctx: PluginInput;
  input: ToolExecuteBeforeInput;
  output: ToolExecuteBeforeOutput;
  config: ArgusAutoReviewConfig;
}): Promise<void> {
  const { ctx, input, output, config } = params;

  if (input.tool.toLowerCase() !== "bash") return;
  const command = output.args.command;
  if (typeof command !== "string") return;

  const detection = detectGitCommit(command);
  if (!detection.isCommit) return;

  if (detection.hasNoVerify) {
    log(`${HOOK_TAG} Skipping review: --no-verify flag set`, {
      sessionID: input.sessionID,
      command,
    });
    return;
  }

  const stagedDiff = await readStagedDiff(ctx.directory);
  if (stagedDiff.trim().length === 0) {
    log(`${HOOK_TAG} No staged/unstaged diff to review`, {
      sessionID: input.sessionID,
    });
    return;
  }

  log(`${HOOK_TAG} Running sync review before git commit`, {
    sessionID: input.sessionID,
    diffBytes: stagedDiff.length,
    timeoutMs: config.timeoutMs,
  });

  const result = await invokeArgusReviewSync({
    ctx,
    parentSessionID: input.sessionID,
    stagedDiff,
    skill: config.skill,
    timeoutMs: config.timeoutMs,
  });

  if (result.status !== "completed") {
    log(`${HOOK_TAG} Review did not complete cleanly; allowing commit`, {
      sessionID: input.sessionID,
      status: result.status,
      error: result.error,
    });
    return;
  }

  const filtered = filterByConfidence(
    result.findings,
    config.confidenceThreshold,
  );

  if (!shouldBlock(filtered, config.blockOnPLevels)) {
    log(`${HOOK_TAG} Review clean, commit allowed`, {
      sessionID: input.sessionID,
      totalFindings: result.findings.length,
      filteredFindings: filtered.length,
    });
    return;
  }

  const message = formatBlockMessage(filtered);
  log(`${HOOK_TAG} BLOCKING commit — ${filtered.length} findings`, {
    sessionID: input.sessionID,
    findingCount: filtered.length,
    priorities: filtered.map((f) => f.priority),
  });

  throw new Error(message);
}
