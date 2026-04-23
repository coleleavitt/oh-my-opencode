import type { PluginInput } from "@opencode-ai/plugin";

import {
  isAgentRegistered,
  resolveRegisteredAgentName,
} from "../../features/claude-code-session-state";
import { createInternalAgentTextPart } from "../../shared/internal-initiator-marker";
import { log } from "../../shared/logger";
import { ARGUS_DEFAULT_SKILL, ARGUS_SUBAGENT_NAME } from "./types";

const HOOK_TAG = "[argus-auto-review]";

export type InvokeArgusReviewResult =
  | "submitted"
  | "skipped_unregistered"
  | "failed";

function buildReviewPrompt(input: {
  editCount: number;
  skill: string;
  recentFiles: readonly string[];
}): string {
  const { editCount, skill, recentFiles } = input;
  const fileList =
    recentFiles.length > 0
      ? recentFiles.map((p) => `- ${p}`).join("\n")
      : "- (file list unavailable; use git status/diff to enumerate changes)";
  return [
    `Auto-review triggered after ${editCount} file edit operations in the current session.`,
    "",
    `Apply the ${skill} skill to review recent changes for bugs, regressions, and safety issues.`,
    "Focus on the following files and any other uncommitted changes visible via git:",
    fileList,
    "",
    "This is an automatic background review. Report findings concisely and do not modify files.",
  ].join("\n");
}

export async function invokeArgusReview(input: {
  ctx: PluginInput;
  sessionID: string;
  editCount: number;
  recentFiles: readonly string[];
  skill?: string;
}): Promise<InvokeArgusReviewResult> {
  const { ctx, sessionID, editCount, recentFiles } = input;
  const skill = input.skill ?? ARGUS_DEFAULT_SKILL;

  const resolvedAgent = resolveRegisteredAgentName(ARGUS_SUBAGENT_NAME);
  if (!resolvedAgent || !isAgentRegistered(resolvedAgent)) {
    log(`${HOOK_TAG} Skipped invocation: code-reviewer not registered`, {
      sessionID,
      editCount,
    });
    return "skipped_unregistered";
  }

  const prompt = buildReviewPrompt({ editCount, skill, recentFiles });

  try {
    await ctx.client.session.promptAsync({
      path: { id: sessionID },
      body: {
        agent: resolvedAgent,
        parts: [createInternalAgentTextPart(prompt)],
      },
      query: { directory: ctx.directory },
    });
    log(`${HOOK_TAG} Auto-review submitted`, {
      sessionID,
      editCount,
      agent: resolvedAgent,
      skill,
    });
    return "submitted";
  } catch (err) {
    log(`${HOOK_TAG} Auto-review invocation failed`, {
      sessionID,
      editCount,
      error: String(err),
    });
    return "failed";
  }
}
