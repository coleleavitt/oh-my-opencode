import type { DelegateTaskArgs, ToolContextWithMetadata, DelegatedModelConfig } from "./types"
import type { ExecutorContext, ParentContext } from "./executor-types"
import type { FallbackEntry } from "../../shared/model-requirements"
import { getTimingConfig } from "./timing"
import { buildTaskPrompt } from "./prompt-builder"
import { storeToolMetadata } from "../../features/tool-metadata-store"
import { resolveCallID } from "./resolve-call-id"
import { formatDetailedError } from "./error-formatting"
import { getSessionTools } from "../../shared/session-tools-store"
import { SessionCategoryRegistry } from "../../shared/session-category-registry"
import { QUESTION_DENIED_SESSION_PERMISSION } from "../../shared/question-denied-session-permission"
import { setSessionFallbackChain } from "../../hooks/model-fallback/hook"
import { stripAgentListSortPrefix, normalizeAgentForPrompt } from "../../shared/agent-display-names"

function continueSessionSetup(args: {
  taskID: string
  manager: ExecutorContext["manager"]
  timing: ReturnType<typeof getTimingConfig>
  fallbackChain?: FallbackEntry[]
  category?: string
}): void {
  if (!args.fallbackChain && !args.category) {
    return
  }

  void (async () => {
    const waitStart = Date.now()
    while (Date.now() - waitStart < args.timing.WAIT_FOR_SESSION_TIMEOUT_MS) {
      await new Promise(resolve => setTimeout(resolve, args.timing.WAIT_FOR_SESSION_INTERVAL_MS))
      const updated = args.manager.getTask(args.taskID)
      if (!updated) {
        return
      }
      if (updated.status === "error" || updated.status === "cancelled" || updated.status === "interrupt") {
        return
      }

      const sessionId = updated.sessionID
      if (!sessionId) {
        continue
      }

      setSessionFallbackChain(sessionId, args.fallbackChain)
      if (args.category) {
        SessionCategoryRegistry.register(sessionId, args.category)
      }
      return
    }
  })()
}

export async function executeBackgroundTask(
  args: DelegateTaskArgs,
  ctx: ToolContextWithMetadata,
  executorCtx: ExecutorContext,
  parentContext: ParentContext,
  agentToUse: string,
  categoryModel: DelegatedModelConfig | undefined,
  systemContent: string | undefined,
  fallbackChain?: FallbackEntry[],
): Promise<string> {
  const { manager } = executorCtx

  try {
    const tddEnabled = executorCtx.sisyphusAgentConfig?.tdd
    // Display-name dispatch (see sync-prompt-sender.ts:81 for the full rationale).
    const normalizedAgent = normalizeAgentForPrompt(agentToUse) ?? stripAgentListSortPrefix(agentToUse)
    const effectivePrompt = buildTaskPrompt(args.prompt, normalizedAgent, tddEnabled)
    const task = await manager.launch({
      description: args.description,
      prompt: effectivePrompt,
      agent: normalizedAgent,
      parentSessionID: parentContext.sessionID,
      parentMessageID: parentContext.messageID,
      parentModel: parentContext.model,
      parentAgent: parentContext.agent,
      parentTools: getSessionTools(parentContext.sessionID),
      model: categoryModel,
      fallbackChain,
      skills: args.load_skills.length > 0 ? args.load_skills : undefined,
      skillContent: systemContent,
      category: args.category,
      sessionPermission: QUESTION_DENIED_SESSION_PERMISSION,
    })

    // OpenCode TUI's `Task` tool UI calculates toolcalls by looking up
    // `props.metadata.sessionId` and then counting tool parts in that session.
    // BackgroundManager.launch() returns immediately (pending) before the session exists,
    // so we must wait briefly for the session to be created to set metadata correctly.
    const timing = getTimingConfig()
    const waitStart = Date.now()
    let sessionId = task.sessionID
    while (!sessionId && Date.now() - waitStart < timing.WAIT_FOR_SESSION_TIMEOUT_MS) {
      const updated = manager.getTask(task.id)
      if (updated?.status === "error" || updated?.status === "cancelled" || updated?.status === "interrupt") {
        return `Task failed to start (status: ${updated.status}).\n\nTask ID: ${task.id}`
      }
      sessionId = updated?.sessionID
      if (sessionId) {
        break
      }
      if (ctx.abort?.aborted) {
        continueSessionSetup({
          taskID: task.id,
          manager,
          timing,
          fallbackChain,
          category: args.category,
        })
        break
      }
      await new Promise(resolve => setTimeout(resolve, timing.WAIT_FOR_SESSION_INTERVAL_MS))
    }

    // Fail-fast when the manager could not create an OpenCode session
    // within the wait budget. If we still have no sessionId and the task
    // is still queued/pending, the dispatch effectively never started —
    // something upstream (concurrency cap, stuck queue) is holding it.
    // Returning success here produces the "0 toolcalls · 0ms" phantom
    // Task in chat that the user can't step into via ctrl+x-down because
    // no OpenCode session was ever created. Surface it as an error so
    // the LLM knows the work didn't dispatch.
    if (!sessionId && !ctx.abort?.aborted) {
      const final = manager.getTask(task.id)
      const status = final?.status
      if (status === "pending") {
        return `Background task never dispatched — the manager didn't create an OpenCode session within ${timing.WAIT_FOR_SESSION_TIMEOUT_MS}ms (task still ${status}). Likely blocked on concurrency or a stuck queue.\n\nTask ID: ${task.id}`
      }
    }

    if (sessionId) {
      setSessionFallbackChain(sessionId, fallbackChain)
    }
    if (args.category && sessionId) {
      SessionCategoryRegistry.register(sessionId, args.category)
    }

    const metadata = {
      prompt: args.prompt,
      agent: task.agent,
      category: args.category,
      load_skills: args.load_skills,
      description: args.description,
      run_in_background: args.run_in_background,
      command: args.command,
      ...(sessionId ? { sessionId } : {}),
      ...(categoryModel ? { model: { providerID: categoryModel.providerID, modelID: categoryModel.modelID } } : {}),
    }

    const unstableMeta = {
      title: args.description,
      metadata,
    }
    await ctx.metadata?.(unstableMeta)
    const callID = resolveCallID(ctx)
    if (callID) {
      storeToolMetadata(ctx.sessionID, callID, unstableMeta)
    }

    const taskMetadataBlock = sessionId
      ? `\n\n<task_metadata>\nsession_id: ${sessionId}\ntask_id: ${task.id}\nbackground_task_id: ${task.id}\n</task_metadata>`
      : ""

    return `Background task launched.

Background Task ID: ${task.id}
Description: ${task.description}
Agent: ${task.agent}${args.category ? ` (category: ${args.category})` : ""}
Status: ${task.status}

System notifies on completion. Use \`background_output\` with task_id="${task.id}" to check.

Do NOT call background_output now. Wait for <system-reminder> notification first.${taskMetadataBlock}`
  } catch (error) {
    return formatDetailedError(error, {
      operation: "Launch background task",
      args,
      agent: stripAgentListSortPrefix(agentToUse),
      category: args.category,
    })
  }
}
