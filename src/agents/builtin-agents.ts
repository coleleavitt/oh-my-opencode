import type { AgentConfig } from "@opencode-ai/sdk";
import type {
  BuiltinAgentName,
  GeneralSubagentName,
  AgentOverrides,
  AgentFactory,
  AgentPromptMetadata,
} from "./types";
import type { CategoriesConfig, GitMasterConfig } from "../config/schema";
import type { LoadedSkill } from "../features/opencode-skill-loader/types";
import type { BrowserAutomationProvider } from "../config/schema";
import { createOracleAgent, ORACLE_PROMPT_METADATA } from "./oracle";
import { createLibrarianAgent, LIBRARIAN_PROMPT_METADATA } from "./librarian";
import { createExploreAgent, EXPLORE_PROMPT_METADATA } from "./explore";
import {
  createMultimodalLookerAgent,
  MULTIMODAL_LOOKER_PROMPT_METADATA,
} from "./multimodal-looker";
import { createMetisAgent, metisPromptMetadata } from "./metis";
import { atlasPromptMetadata } from "./atlas";
import { createMomusAgent, momusPromptMetadata } from "./momus";
import { createArgusAgent, ARGUS_PROMPT_METADATA } from "./argus";
import { createForkAgent, FORK_PROMPT_METADATA } from "./fork-agent";
// Primary agent factories (createSisyphusAgent, createHephaestusAgent,
// createAtlasAgent, createSisyphusJuniorAgentWithOverrides) are imported
// directly by their dedicated maybeCreate*Config builders — they don't
// participate in the generic agentSources loop.
import type { AvailableCategory } from "./dynamic-agent-prompt-builder";
import {
  fetchAvailableModels,
  readConnectedProvidersCache,
  readProviderModelsCache,
} from "../shared";
import { CATEGORY_DESCRIPTIONS } from "../tools/delegate-task/constants";
import { mergeCategories } from "../shared/merge-categories";
import { buildAvailableSkills } from "./builtin-agents/available-skills";
import { collectPendingBuiltinAgents } from "./builtin-agents/general-agents";
import { maybeCreateSisyphusConfig } from "./builtin-agents/sisyphus-agent";
import { maybeCreateHephaestusConfig } from "./builtin-agents/hephaestus-agent";
import { maybeCreateAtlasConfig } from "./builtin-agents/atlas-agent";

type AgentSource = AgentFactory | AgentConfig;

// agentSources holds only the general-subagent factories iterated by
// collectPendingBuiltinAgents. The 4 primary-ish agents (sisyphus,
// hephaestus, atlas, sisyphus-junior) have dedicated maybeCreate*Config
// builders that take richer context than a model string, so they don't
// belong in this record — keeping them here previously required unsafe
// casts (`as AgentFactory`, `as unknown as AgentFactory`) and 4
// matching `continue` lines in general-agents.ts. Both gone now.
const agentSources: Record<GeneralSubagentName, AgentSource> = {
  oracle: createOracleAgent,
  librarian: createLibrarianAgent,
  explore: createExploreAgent,
  "multimodal-looker": createMultimodalLookerAgent,
  metis: createMetisAgent,
  momus: createMomusAgent,
  // code-reviewer is an intentional alias of argus — both names are
  // user-callable delegation targets and share the factory + metadata.
  "code-reviewer": createArgusAgent,
  argus: createArgusAgent,
  fork: createForkAgent,
};

/**
 * Metadata for each agent, used to build Sisyphus's dynamic prompt sections
 * (Delegation Table, Tool Selection, Key Triggers, etc.)
 */
const agentMetadata: Partial<Record<BuiltinAgentName, AgentPromptMetadata>> = {
  oracle: ORACLE_PROMPT_METADATA,
  librarian: LIBRARIAN_PROMPT_METADATA,
  explore: EXPLORE_PROMPT_METADATA,
  "multimodal-looker": MULTIMODAL_LOOKER_PROMPT_METADATA,
  metis: metisPromptMetadata,
  momus: momusPromptMetadata,
  atlas: atlasPromptMetadata,
  "code-reviewer": ARGUS_PROMPT_METADATA,
  argus: ARGUS_PROMPT_METADATA,
  fork: FORK_PROMPT_METADATA,
};

export async function createBuiltinAgents(
  disabledAgents: string[] = [],
  agentOverrides: AgentOverrides = {},
  directory?: string,
  systemDefaultModel?: string,
  categories?: CategoriesConfig,
  gitMasterConfig?: GitMasterConfig,
  discoveredSkills: LoadedSkill[] = [],
  customAgentSummaries?: unknown,
  browserProvider?: BrowserAutomationProvider,
  uiSelectedModel?: string,
  disabledSkills?: Set<string>,
  useTaskSystem = false,
  disableOmoEnv = false,
): Promise<Record<string, AgentConfig>> {
  const connectedProviders = readConnectedProvidersCache();
  const providerModelsConnected = connectedProviders
    ? (readProviderModelsCache()?.connected ?? [])
    : [];
  const mergedConnectedProviders = Array.from(
    new Set([...(connectedProviders ?? []), ...providerModelsConnected]),
  );
  // IMPORTANT: Do NOT call OpenCode client APIs during plugin initialization.
  // This function is called from config handler, and calling client API causes deadlock.
  // See: https://github.com/code-yeongyu/oh-my-openagent/issues/1301
  const availableModels = await fetchAvailableModels(undefined, {
    connectedProviders:
      mergedConnectedProviders.length > 0
        ? mergedConnectedProviders
        : undefined,
  });
  const isFirstRunNoCache =
    availableModels.size === 0 && mergedConnectedProviders.length === 0;

  const result: Record<string, AgentConfig> = {};

  const mergedCategories = mergeCategories(categories);

  const availableCategories: AvailableCategory[] = Object.entries(
    mergedCategories,
  ).map(([name]) => ({
    name,
    description:
      categories?.[name]?.description ??
      CATEGORY_DESCRIPTIONS[name] ??
      "General tasks",
  }));

  const availableSkills = buildAvailableSkills(
    discoveredSkills,
    browserProvider,
    disabledSkills,
  );

  // Collect general agents first (for availableAgents), but don't add to result yet
  const { pendingAgentConfigs, availableAgents } = collectPendingBuiltinAgents({
    agentSources,
    agentMetadata,
    disabledAgents,
    agentOverrides,
    directory,
    systemDefaultModel,
    mergedCategories,
    gitMasterConfig,
    browserProvider,
    uiSelectedModel,
    availableModels,
    isFirstRunNoCache,
    disabledSkills,
    disableOmoEnv,
  });

  const sisyphusConfig = maybeCreateSisyphusConfig({
    disabledAgents,
    agentOverrides,
    uiSelectedModel,
    availableModels,
    systemDefaultModel,
    isFirstRunNoCache,
    availableAgents,
    availableSkills,
    availableCategories,
    mergedCategories,
    directory,
    userCategories: categories,
    useTaskSystem,
    disableOmoEnv,
  });
  if (sisyphusConfig) {
    result["sisyphus"] = sisyphusConfig;
  }

  const hephaestusConfig = maybeCreateHephaestusConfig({
    disabledAgents,
    agentOverrides,
    availableModels,
    systemDefaultModel,
    isFirstRunNoCache,
    availableAgents,
    availableSkills,
    availableCategories,
    mergedCategories,
    directory,
    useTaskSystem,
    disableOmoEnv,
  });
  if (hephaestusConfig) {
    result["hephaestus"] = hephaestusConfig;
  }

  // Add pending agents after sisyphus and hephaestus to maintain order
  for (const [name, config] of pendingAgentConfigs) {
    result[name] = config;
  }

  const atlasConfig = maybeCreateAtlasConfig({
    disabledAgents,
    agentOverrides,
    uiSelectedModel,
    availableModels,
    systemDefaultModel,
    availableAgents,
    availableSkills,
    mergedCategories,
    directory,
    userCategories: categories,
  });
  if (atlasConfig) {
    result["atlas"] = atlasConfig;
  }

  return result;
}
