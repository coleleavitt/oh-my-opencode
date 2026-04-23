import type { PluginInput } from "@opencode-ai/plugin";

import {
  isAgentRegistered,
  resolveRegisteredAgentName,
} from "../../features/claude-code-session-state";
import { createInternalAgentTextPart } from "../../shared/internal-initiator-marker";
import { log } from "../../shared/logger";
import { QUESTION_DENIED_SESSION_PERMISSION } from "../../shared/question-denied-session-permission";
import { parseArgusFindings } from "./p-level-parser";
import type { ParsedFinding } from "./types";
import { ARGUS_SUBAGENT_NAME } from "./types";

const HOOK_TAG = "[argus-auto-review:sync]";

export interface SyncReviewResult {
  status: "completed" | "skipped_unregistered" | "failed" | "timeout";
  findings: ParsedFinding[];
  rawOutput: string;
  error?: string;
}

function buildPreCommitPrompt(input: {
  stagedDiff: string;
  skill: string;
}): string {
  const { stagedDiff, skill } = input;
  const diffExcerpt =
    stagedDiff.length > 50_000
      ? `${stagedDiff.slice(0, 50_000)}\n\n[truncated ${stagedDiff.length - 50_000} chars]`
      : stagedDiff;
  return [
    `Pre-commit auto-review triggered. The agent is about to run \`git commit\`.`,
    "",
    `Apply the ${skill} skill to review the STAGED changes below and produce 5-axis findings.`,
    "Only report findings at HIGH or CERTAIN confidence. Do NOT modify files. Do NOT run git.",
    "",
    "If you find blocking issues (P-1, P-2, P-3, P-4), emit them in the mandatory 5-axis format.",
    "If the staged changes are safe, emit a single line: `NO BLOCKING FINDINGS`.",
    "",
    "=== STAGED DIFF ===",
    diffExcerpt,
    "=== END STAGED DIFF ===",
  ].join("\n");
}

async function extractLastAssistantText(
  ctx: PluginInput,
  sessionID: string,
): Promise<string> {
  try {
    const result = await ctx.client.session.messages({
      path: { id: sessionID },
    });
    const rawData = (result as { data?: unknown })?.data ?? result;
    const msgs = Array.isArray(rawData)
      ? (rawData as Array<{
          info?: { role?: string };
          parts?: Array<{ type?: string; text?: string }>;
        }>)
      : [];
    const lastAssistant = [...msgs]
      .reverse()
      .find((m) => m.info?.role === "assistant");
    if (!lastAssistant?.parts) return "";
    const textParts = lastAssistant.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string);
    return textParts.join("\n").trim();
  } catch (err) {
    log(`${HOOK_TAG} Failed to read messages`, {
      sessionID,
      error: String(err),
    });
    return "";
  }
}

export async function invokeArgusReviewSync(input: {
  ctx: PluginInput;
  parentSessionID: string;
  stagedDiff: string;
  skill: string;
  timeoutMs: number;
}): Promise<SyncReviewResult> {
  const { ctx, parentSessionID, stagedDiff, skill, timeoutMs } = input;

  const resolvedAgent = resolveRegisteredAgentName(ARGUS_SUBAGENT_NAME);
  if (!resolvedAgent || !isAgentRegistered(resolvedAgent)) {
    log(`${HOOK_TAG} Skipped: code-reviewer agent not registered`, {
      parentSessionID,
    });
    return {
      status: "skipped_unregistered",
      findings: [],
      rawOutput: "",
    };
  }

  let childSessionID: string | undefined;
  try {
    const createResult = await ctx.client.session.create({
      body: {
        parentID: parentSessionID,
        title: `argus pre-commit review`,
        permission: QUESTION_DENIED_SESSION_PERMISSION,
      } as Record<string, unknown>,
      query: { directory: ctx.directory },
    });
    if (createResult.error || !createResult.data?.id) {
      return {
        status: "failed",
        findings: [],
        rawOutput: "",
        error: `Failed to create child session: ${String(createResult.error)}`,
      };
    }
    childSessionID = createResult.data.id;

    const prompt = buildPreCommitPrompt({ stagedDiff, skill });

    const deadline = Date.now() + timeoutMs;
    const promptPromise = ctx.client.session.prompt({
      path: { id: childSessionID },
      body: {
        agent: resolvedAgent,
        parts: [createInternalAgentTextPart(prompt)],
      },
    } as Parameters<typeof ctx.client.session.prompt>[0]);

    const timeoutPromise = new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), Math.max(1000, deadline - Date.now()));
    });

    const raceResult = await Promise.race([
      promptPromise.then(() => "ok" as const),
      timeoutPromise,
    ]);

    if (raceResult === "timeout") {
      log(`${HOOK_TAG} Review timed out`, {
        parentSessionID,
        childSessionID,
        timeoutMs,
      });
      await ctx.client.session
        .abort({ path: { id: childSessionID } })
        .catch(() => {});
      return { status: "timeout", findings: [], rawOutput: "" };
    }

    const rawOutput = await extractLastAssistantText(ctx, childSessionID);
    const findings = parseArgusFindings(rawOutput);

    log(`${HOOK_TAG} Review completed`, {
      parentSessionID,
      childSessionID,
      findingCount: findings.length,
    });

    return { status: "completed", findings, rawOutput };
  } catch (err) {
    log(`${HOOK_TAG} Review invocation failed`, {
      parentSessionID,
      childSessionID,
      error: String(err),
    });
    return {
      status: "failed",
      findings: [],
      rawOutput: "",
      error: String(err),
    };
  }
}
