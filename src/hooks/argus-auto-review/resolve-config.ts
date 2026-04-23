import type {
  Confidence,
  PLevel,
} from "../../config/schema/argus-auto-review";
import type { OhMyOpenCodeConfig } from "../../config";
import type { ArgusAutoReviewConfig } from "./types";
import { DEFAULT_ARGUS_AUTO_REVIEW_CONFIG } from "./types";

const ENV_ENABLED = "OMO_ARGUS_AUTO_REVIEW";
const ENV_MODE = "OMO_ARGUS_AUTO_REVIEW_MODE";
const ENV_THRESHOLD = "OMO_ARGUS_AUTO_REVIEW_THRESHOLD";
const ENV_COOLDOWN_MS = "OMO_ARGUS_AUTO_REVIEW_COOLDOWN_MS";
const ENV_BLOCK_ON = "OMO_ARGUS_BLOCK_ON";
const ENV_CONFIDENCE = "OMO_ARGUS_CONFIDENCE";
const ENV_SKILL = "OMO_ARGUS_SKILL";
const ENV_TIMEOUT_MS = "OMO_ARGUS_TIMEOUT_MS";
const ENV_AUTO_VERIFY_AFTER_N_TASKS = "OMO_ARGUS_AUTO_VERIFY_AFTER_N_TASKS";

const VALID_MODES: ReadonlySet<string> = new Set([
  "pre-commit",
  "n-edits",
  "post-tool-use",
  "hybrid",
]);
const VALID_P_LEVELS: ReadonlySet<string> = new Set([
  "P-1",
  "P-2",
  "P-3",
  "P-4",
]);
const VALID_CONFIDENCE: ReadonlySet<string> = new Set([
  "low",
  "medium",
  "high",
  "certain",
]);

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseNonNegativeInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseBlockOnEnv(value: string | undefined): readonly PLevel[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const validated = parts.filter((p): p is PLevel => VALID_P_LEVELS.has(p));
  return validated.length > 0 ? validated : undefined;
}

export type ArgusAutoReviewConfigFromSchema =
  OhMyOpenCodeConfig["argus_auto_review"];

export function resolveArgusAutoReviewConfig(
  userConfig: ArgusAutoReviewConfigFromSchema | undefined,
): ArgusAutoReviewConfig {
  const base: ArgusAutoReviewConfig = {
    enabled: userConfig?.enabled ?? DEFAULT_ARGUS_AUTO_REVIEW_CONFIG.enabled,
    mode: userConfig?.mode ?? DEFAULT_ARGUS_AUTO_REVIEW_CONFIG.mode,
    editThreshold:
      userConfig?.edit_threshold ??
      DEFAULT_ARGUS_AUTO_REVIEW_CONFIG.editThreshold,
    cooldownMs:
      userConfig?.cooldown_ms ?? DEFAULT_ARGUS_AUTO_REVIEW_CONFIG.cooldownMs,
    blockOnPLevels:
      userConfig?.block_on_p_levels ??
      DEFAULT_ARGUS_AUTO_REVIEW_CONFIG.blockOnPLevels,
    confidenceThreshold:
      userConfig?.confidence_threshold ??
      DEFAULT_ARGUS_AUTO_REVIEW_CONFIG.confidenceThreshold,
    skill: userConfig?.skill ?? DEFAULT_ARGUS_AUTO_REVIEW_CONFIG.skill,
    timeoutMs:
      userConfig?.timeout_ms ?? DEFAULT_ARGUS_AUTO_REVIEW_CONFIG.timeoutMs,
    autoVerifyAfterNTasks:
      userConfig?.auto_verify_after_n_tasks ??
      DEFAULT_ARGUS_AUTO_REVIEW_CONFIG.autoVerifyAfterNTasks,
  };

  const envEnabled = process.env[ENV_ENABLED];
  if (envEnabled === "1") base.enabled = true;
  if (envEnabled === "0") base.enabled = false;

  const envMode = process.env[ENV_MODE];
  if (envMode && VALID_MODES.has(envMode)) {
    base.mode = envMode as ArgusAutoReviewConfig["mode"];
  }

  const envThreshold = parsePositiveInt(process.env[ENV_THRESHOLD]);
  if (envThreshold !== undefined) base.editThreshold = envThreshold;

  const envCooldown = parsePositiveInt(process.env[ENV_COOLDOWN_MS]);
  if (envCooldown !== undefined) base.cooldownMs = envCooldown;

  const envBlockOn = parseBlockOnEnv(process.env[ENV_BLOCK_ON]);
  if (envBlockOn !== undefined) base.blockOnPLevels = envBlockOn;

  const envConfidence = process.env[ENV_CONFIDENCE];
  if (envConfidence && VALID_CONFIDENCE.has(envConfidence)) {
    base.confidenceThreshold = envConfidence as Confidence;
  }

  const envSkill = process.env[ENV_SKILL]?.trim();
  if (envSkill) base.skill = envSkill;

  const envTimeout = parsePositiveInt(process.env[ENV_TIMEOUT_MS]);
  if (envTimeout !== undefined) base.timeoutMs = envTimeout;

  const envAutoVerify = parseNonNegativeInt(
    process.env[ENV_AUTO_VERIFY_AFTER_N_TASKS],
  );
  if (envAutoVerify !== undefined) base.autoVerifyAfterNTasks = envAutoVerify;

  return base;
}
