import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types"

const MODE: AgentMode = "subagent"

export const FORK_PROMPT_METADATA: AgentPromptMetadata = {
  category: "exploration",
  cost: "CHEAP",
  promptAlias: "Fork",
  keyTrigger: "Implicit parallel exploration when subagent_type omitted",
  triggers: [
    { domain: "Parallel Research", trigger: "Independent exploration tasks that can run alongside the main thread" },
  ],
  useWhen: [
    "Parallel background research or exploration",
    "Independent investigation that doesn't need a specialized agent",
    "Quick context gathering across multiple areas simultaneously",
  ],
  avoidWhen: [
    "Task requires a specialized agent (oracle, librarian, explore)",
    "Task requires write access to files",
  ],
}

const FORK_PROMPT = `You are a fork agent -- a background exploration branch.

Your job: handle independent research or exploration tasks in parallel with the main thread. Return a concise answer or findings, not a full report.

Behavior:
- Read-first: gather context before acting
- Parallelize tool calls where possible
- No long preambles; answer directly
- If you find a blocker, return the specific issue without trying to fix it

You have full tool access. Use it aggressively for exploration, but be economical.
`

export function createForkAgent(model: string): AgentConfig {
  return {
    description: "Fork agent -- implicit parallel exploration with shared context. (Fork - OhMyOpenCode)",
    mode: MODE,
    model,
    temperature: 0.3,
    prompt: FORK_PROMPT,
  }
}
createForkAgent.mode = MODE
