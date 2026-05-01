import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { spawn, type ChildProcess } from "child_process"
import { log } from "../../shared/logger"

type MonitorEntry = {
  id: string
  description: string
  process: ChildProcess
  lines: string[]
  startedAt: number
}

const monitors = new Map<string, MonitorEntry>()
let monitorCounter = 0

function generateMonitorId(): string {
  monitorCounter += 1
  return `monitor_${monitorCounter}_${Date.now()}`
}

function cleanupMonitor(id: string): void {
  const entry = monitors.get(id)
  if (!entry) return
  try {
    entry.process.kill()
  } catch {
    // process may have already exited
  }
  monitors.delete(id)
}

export function cleanupAllMonitors(): void {
  for (const id of monitors.keys()) {
    cleanupMonitor(id)
  }
}

export function getMonitorLines(id: string): string[] | null {
  return monitors.get(id)?.lines ?? null
}

export function createMonitorTool(): ToolDefinition {
  return tool({
    description:
      "Start a background monitor that runs a shell command. Each stdout line is captured as a notification. " +
      "Use to watch logs, build output, or long-running processes. Query the monitor ID to retrieve captured lines.",
    args: {
      command: tool.schema.string().describe("Shell command to run in the background"),
      description: tool.schema.string().describe("Human-readable label for this monitor"),
      persistent: tool.schema
        .boolean()
        .optional()
        .describe("If true, monitor runs for the entire session lifetime"),
    },
    async execute(rawArgs: { command: string; description: string; persistent?: boolean }) {
      const { command, description } = rawArgs
      const id = generateMonitorId()

      let child: ChildProcess
      try {
        child = spawn(command, { shell: true, stdio: ["ignore", "pipe", "pipe"] })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return `Failed to start monitor: ${msg}`
      }

      const entry: MonitorEntry = {
        id,
        description,
        process: child,
        lines: [],
        startedAt: Date.now(),
      }
      monitors.set(id, entry)

      const MAX_CAPTURED_LINES = 500

      const handleLine = (source: string, data: Buffer) => {
        const text = data.toString("utf-8")
        for (const line of text.split("\n")) {
          const trimmed = line.trimEnd()
          if (trimmed.length === 0) continue
          if (entry.lines.length < MAX_CAPTURED_LINES) {
            entry.lines.push(`[${source}] ${trimmed}`)
          }
          // TODO: When OMO supports mid-conversation system message injection (context.inject),
          // each line should be injected as a task_notification into the active conversation.
          // For now, lines are captured and retrievable via getMonitorLines().
          log(`[monitor:${id}] [${source}] ${trimmed}`)
        }
      }

      child.stdout?.on("data", (data: Buffer) => handleLine("stdout", data))
      child.stderr?.on("data", (data: Buffer) => handleLine("stderr", data))

      child.on("exit", (code) => {
        log(`[monitor:${id}] process exited with code ${code}`)
        entry.lines.push(`[exit] process exited with code ${code}`)
      })

      child.on("error", (err) => {
        log(`[monitor:${id}] process error: ${err.message}`)
        entry.lines.push(`[error] ${err.message}`)
      })

      return [
        `Monitor started: ${description}`,
        `ID: ${id}`,
        `Command: ${command}`,
        `Persistent: ${rawArgs.persistent ?? false}`,
        "",
        "Lines are captured in the background. Query this monitor ID to retrieve output.",
      ].join("\n")
    },
  })
}
