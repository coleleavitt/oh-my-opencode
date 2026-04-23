import type { StatusLineConfig } from "../../config/schema/status-line"
import { getSessionCost } from "../cost-tracker/hook"
import { getSessionModel } from "../../shared/session-model-state"
import { runStatusLine } from "../../features/status-line"

export function createStatusLineHook(config: StatusLineConfig) {
  if (!config?.enabled || !config.command) return {}

  return {
    event: async ({
      event,
    }: {
      event: { type: string; properties?: unknown }
    }) => {
      if (event.type !== "session.idle") return

      const props = event.properties as
        | { sessionID?: string }
        | undefined
      const sessionID = props?.sessionID
      if (!sessionID) return

      const sessionModel = getSessionModel(sessionID)
      const cost = getSessionCost(sessionID)
      let totalInput = 0
      let totalOutput = 0
      if (cost) {
        for (const m of cost.models.values()) {
          totalInput += m.input
          totalOutput += m.output
        }
      }

      await runStatusLine(config, {
        session_id: sessionID,
        model: sessionModel?.modelID,
        provider: sessionModel?.providerID,
        cost_usd: cost?.total,
        tokens: cost ? { input: totalInput, output: totalOutput } : undefined,
      })
    },
  }
}
