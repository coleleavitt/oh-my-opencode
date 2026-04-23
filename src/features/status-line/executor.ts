import { spawn } from "node:child_process"
import { homedir } from "node:os"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join } from "node:path"
import type { StatusLineConfig } from "../../config/schema/status-line"
import { log } from "../../shared/logger"

const HOOK_TAG = "[status-line]"
const DEFAULT_OUTPUT_FILE = join(
  process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"),
  "oh-my-opencode",
  "statusline.txt",
)

function resolveOutputPath(configured: string | undefined): string {
  if (!configured) return DEFAULT_OUTPUT_FILE
  if (configured.startsWith("~/")) {
    return join(homedir(), configured.slice(2))
  }
  return isAbsolute(configured) ? configured : join(process.cwd(), configured)
}

export interface StatusLinePayload {
  session_id: string
  model?: string
  provider?: string
  cost_usd?: number
  tokens?: { input: number; output: number }
}

export async function runStatusLine(
  config: StatusLineConfig,
  payload: StatusLinePayload,
): Promise<void> {
  if (!config.enabled || !config.command) return

  const command = config.command
  const stdinJson = JSON.stringify(payload)
  let output = ""
  let settled = false

  await new Promise<void>((resolve) => {
    const child = spawn(command, {
      shell: true,
    })

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        child.kill("SIGTERM")
        child.stdout?.destroy()
        child.stderr?.destroy()
      } catch (err) {
        log(`${HOOK_TAG} SIGTERM failed during timeout cleanup`, {
          error: String(err),
        })
      }
      resolve()
    }, config.timeout_ms)

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8")
    })

    child.stderr.on("data", (chunk: Buffer) => {
      log(`${HOOK_TAG} stderr`, {
        command: command.slice(0, 50),
        stderr: chunk.toString("utf8").slice(0, 200),
      })
    })

    child.on("error", (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      log(`${HOOK_TAG} spawn failed`, {
        command: command.slice(0, 50),
        error: String(err),
      })
      resolve()
    })

    child.on("close", () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    })

    child.stdin.on("error", () => {})
    child.stdin.write(stdinJson)
    child.stdin.end()
  })

  const line = output.split("\n")[0].trim()
  const padded =
    typeof config.padding === "number" ? line.padEnd(config.padding) : line

  const outputPath = resolveOutputPath(config.output_file)
  try {
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, padded + "\n", "utf8")
  } catch (err) {
    log(`${HOOK_TAG} failed to write status file`, {
      outputPath,
      error: String(err),
    })
  }
}
