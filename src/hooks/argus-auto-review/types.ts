import type {
  ArgusAutoReviewMode,
  Confidence,
  PLevel,
} from "../../config/schema/argus-auto-review";

// given: v117 shell-hook model has async: true + asyncRewake: true + exitCode === 2 to wake model
// when: fork runs hooks in-process (no shell, no exit codes)
// then: equivalent in-process semantics documented below
export const ASYNC_REWAKE_CONTRACT = {
  asyncInvoker: "invokeArgusReview (review-invoker.ts) — non-blocking async review",
  blockingInvoker: "invokeArgusReviewSync (review-invoker-sync.ts) — sync blocking review, throws on findings",
  rewakeTrigger: "shouldBlock(findings, blockOnPLevels) → throw new Error(formatBlockMessage(findings))",
  userSummary: "log() line tagged [argus-auto-review:pre-commit] BLOCKING",
} as const;

export type ArgusAutoReviewMode_Runtime = ArgusAutoReviewMode;
export type PLevel_Runtime = PLevel;
export type Confidence_Runtime = Confidence;

export interface ArgusAutoReviewConfig {
  enabled: boolean;
  mode: ArgusAutoReviewMode;
  editThreshold: number;
  cooldownMs: number;
  blockOnPLevels: readonly PLevel[];
  confidenceThreshold: Confidence;
  skill: string;
  timeoutMs: number;
  autoVerifyAfterNTasks: number;
}

export interface ArgusAutoReviewState {
  editCount: number;
  lastReviewAt: number;
}

export const DEFAULT_ARGUS_AUTO_REVIEW_CONFIG: Readonly<ArgusAutoReviewConfig> =
  {
    enabled: false,
    mode: "hybrid",
    editThreshold: 10,
    cooldownMs: 900_000,
    blockOnPLevels: ["P-1", "P-2", "P-3", "P-4"] as const,
    confidenceThreshold: "high",
    skill: "argus-review",
    timeoutMs: 180_000,
    autoVerifyAfterNTasks: 3,
  };

export const ARGUS_SUBAGENT_NAME = "code-reviewer";

export const ARGUS_DEFAULT_SKILL = "argus-review";

export interface ParsedFinding {
  number: number;
  title: string;
  priority: PLevel;
  priorityLabel: string;
  impact: string;
  trigger: string;
  blastRadius: string;
  fixEffort: string;
  confidence: Confidence;
  location: string;
  issue: string;
  recommendation?: string;
  rationale?: string;
  raw: string;
}
