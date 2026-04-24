/**
 * Atlas prompt resolver. Maps model → prompt text. Replaces the prior
 * per-variant wrapper files (default.ts / gemini.ts / gpt.ts) which were
 * each a 22-line shim around `buildAtlasPrompt({...})`.
 *
 * The variant prompts themselves (default / gemini / gpt) still live in
 * separate *-prompt-sections.ts files because they contain genuine
 * model-specific behavioral differences. Only the wrapper boilerplate
 * was removed.
 */

import { buildAtlasPrompt } from "./shared-prompt"
import {
  DEFAULT_ATLAS_INTRO,
  DEFAULT_ATLAS_WORKFLOW,
  DEFAULT_ATLAS_PARALLEL_EXECUTION,
  DEFAULT_ATLAS_VERIFICATION_RULES,
  DEFAULT_ATLAS_BOUNDARIES,
  DEFAULT_ATLAS_CRITICAL_RULES,
} from "./default-prompt-sections"
import {
  GEMINI_ATLAS_INTRO,
  GEMINI_ATLAS_WORKFLOW,
  GEMINI_ATLAS_PARALLEL_EXECUTION,
  GEMINI_ATLAS_VERIFICATION_RULES,
  GEMINI_ATLAS_BOUNDARIES,
  GEMINI_ATLAS_CRITICAL_RULES,
} from "./gemini-prompt-sections"
import {
  GPT_ATLAS_INTRO,
  GPT_ATLAS_WORKFLOW,
  GPT_ATLAS_PARALLEL_EXECUTION,
  GPT_ATLAS_VERIFICATION_RULES,
  GPT_ATLAS_BOUNDARIES,
  GPT_ATLAS_CRITICAL_RULES,
} from "./gpt-prompt-sections"

export type AtlasPromptSource = "default" | "gpt" | "gemini"

const ATLAS_PROMPTS: Record<AtlasPromptSource, string> = {
  default: buildAtlasPrompt({
    intro: DEFAULT_ATLAS_INTRO,
    workflow: DEFAULT_ATLAS_WORKFLOW,
    parallelExecution: DEFAULT_ATLAS_PARALLEL_EXECUTION,
    verificationRules: DEFAULT_ATLAS_VERIFICATION_RULES,
    boundaries: DEFAULT_ATLAS_BOUNDARIES,
    criticalRules: DEFAULT_ATLAS_CRITICAL_RULES,
  }),
  gemini: buildAtlasPrompt({
    intro: GEMINI_ATLAS_INTRO,
    workflow: GEMINI_ATLAS_WORKFLOW,
    parallelExecution: GEMINI_ATLAS_PARALLEL_EXECUTION,
    verificationRules: GEMINI_ATLAS_VERIFICATION_RULES,
    boundaries: GEMINI_ATLAS_BOUNDARIES,
    criticalRules: GEMINI_ATLAS_CRITICAL_RULES,
  }),
  gpt: buildAtlasPrompt({
    intro: GPT_ATLAS_INTRO,
    workflow: GPT_ATLAS_WORKFLOW,
    parallelExecution: GPT_ATLAS_PARALLEL_EXECUTION,
    verificationRules: GPT_ATLAS_VERIFICATION_RULES,
    boundaries: GPT_ATLAS_BOUNDARIES,
    criticalRules: GPT_ATLAS_CRITICAL_RULES,
  }),
}

export function getAtlasPromptFor(source: AtlasPromptSource): string {
  return ATLAS_PROMPTS[source]
}

export const ATLAS_SYSTEM_PROMPT = ATLAS_PROMPTS.default
export const ATLAS_GEMINI_SYSTEM_PROMPT = ATLAS_PROMPTS.gemini
export const ATLAS_GPT_SYSTEM_PROMPT = ATLAS_PROMPTS.gpt
