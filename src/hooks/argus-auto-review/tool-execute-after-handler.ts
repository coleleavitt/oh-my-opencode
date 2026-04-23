import type { PluginInput } from "@opencode-ai/plugin";

import { recordTaskCompletion } from "./completion-tracker";
import { recordEditAndCheck } from "./edit-threshold-detector";
import { invokeArgusReview } from "./review-invoker";
import type { ArgusAutoReviewConfig } from "./types";

const EDIT_TOOL_NAMES: ReadonlySet<string> = new Set([
  "edit",
  "write",
  "apply_patch",
  "hashline_edit",
]);

const MAX_RECENT_FILES = 10;

export interface ToolExecuteAfterInput {
  tool: string;
  sessionID: string;
  callID: string;
  args?: unknown;
}

export interface ToolExecuteAfterOutput {
  output?: unknown;
  metadata?: unknown;
}

function extractFilePath(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const record = args as Record<string, unknown>;
  for (const key of ["filePath", "file_path", "path"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  return undefined;
}

function pushRecentFile(
  recentFilesBySession: Map<string, string[]>,
  sessionID: string,
  filePath: string,
): void {
  let list = recentFilesBySession.get(sessionID);
  if (!list) {
    list = [];
    recentFilesBySession.set(sessionID, list);
  }
  const existing = list.indexOf(filePath);
  if (existing !== -1) list.splice(existing, 1);
  list.push(filePath);
  if (list.length > MAX_RECENT_FILES) list.shift();
}

function snapshotAndClearRecentFiles(
  recentFilesBySession: Map<string, string[]>,
  sessionID: string,
): readonly string[] {
  const list = recentFilesBySession.get(sessionID) ?? [];
  recentFilesBySession.delete(sessionID);
  return [...list];
}

function handleTaskCompletion(params: {
  ctx: PluginInput;
  input: ToolExecuteAfterInput;
  config: ArgusAutoReviewConfig;
  recentFilesBySession: Map<string, string[]>;
}): void {
  const { ctx, input, config, recentFilesBySession } = params;
  const { shouldVerify, taskCount } = recordTaskCompletion(
    input.sessionID,
    config.autoVerifyAfterNTasks,
  );
  if (!shouldVerify) return;

  const recentFiles = snapshotAndClearRecentFiles(
    recentFilesBySession,
    input.sessionID,
  );
  void invokeArgusReview({
    ctx,
    sessionID: input.sessionID,
    editCount: taskCount,
    recentFiles,
    skill: config.skill,
  });
}

export async function handleEditTrackingAfter(params: {
  ctx: PluginInput;
  input: ToolExecuteAfterInput;
  output: ToolExecuteAfterOutput;
  config: ArgusAutoReviewConfig;
  recentFilesBySession: Map<string, string[]>;
}): Promise<void> {
  const { ctx, input, output, config, recentFilesBySession } = params;
  if (!output) return;
  if (!input.sessionID) return;

  // when: task tool completes, track for auto-verification
  if (input.tool.toLowerCase() === "task") {
    handleTaskCompletion({ ctx, input, config, recentFilesBySession });
    return;
  }

  if (!EDIT_TOOL_NAMES.has(input.tool.toLowerCase())) return;

  const metadataRecord =
    output.metadata && typeof output.metadata === "object"
      ? (output.metadata as Record<string, unknown>)
      : undefined;
  if (metadataRecord?.error === true) return;

  const outputText =
    typeof output.output === "string" ? output.output : "";
  if (/^\s*(error|failed|exception)[\s:.]/i.test(outputText)) return;

  const filePath =
    extractFilePath(input.args) ??
    (() => {
      const meta = output.metadata as { filePath?: unknown } | undefined;
      const metaPath = meta?.filePath;
      return typeof metaPath === "string" ? metaPath : undefined;
    })();
  if (filePath) pushRecentFile(recentFilesBySession, input.sessionID, filePath);

  if (config.mode !== "n-edits" && config.mode !== "hybrid") {
    return;
  }

  const { shouldFire, editCount } = recordEditAndCheck(input.sessionID, {
    enabled: config.enabled,
    editThreshold: config.editThreshold,
    cooldownMs: config.cooldownMs,
  });
  if (!shouldFire) return;

  const recentFiles = snapshotAndClearRecentFiles(
    recentFilesBySession,
    input.sessionID,
  );
  void invokeArgusReview({
    ctx,
    sessionID: input.sessionID,
    editCount,
    recentFiles,
    skill: config.skill,
  });
}
