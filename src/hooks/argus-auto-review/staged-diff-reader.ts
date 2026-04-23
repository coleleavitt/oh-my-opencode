import { spawn } from "node:child_process";

import { log } from "../../shared/logger";

const HOOK_TAG = "[argus-auto-review:diff]";
const DEFAULT_TIMEOUT_MS = 5000;

function runGitCommand(
  args: readonly string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn("git", args as string[], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_PAGER: "cat", PAGER: "cat" },
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGTERM");
      } catch (err) {
        log(`${HOOK_TAG} SIGTERM failed during timeout cleanup`, {
          error: String(err),
        });
      }
      log(`${HOOK_TAG} git command timed out`, { args, timeoutMs });
      resolve({ stdout: "", exitCode: -1 });
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      log(`${HOOK_TAG} git command error`, { args, error: String(err) });
      resolve({ stdout: "", exitCode: -1 });
    });

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (stderr && exitCode !== 0) {
        log(`${HOOK_TAG} git stderr`, {
          args,
          exitCode,
          stderrPreview: stderr.slice(0, 200),
        });
      }
      resolve({ stdout, exitCode: exitCode ?? -1 });
    });
  });
}

export async function readStagedDiff(
  cwd: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const cached = await runGitCommand(
    ["diff", "--cached", "--no-color"],
    cwd,
    timeoutMs,
  );
  if (cached.exitCode !== 0) {
    return "";
  }
  if (cached.stdout.trim().length > 0) {
    return cached.stdout;
  }
  const unstaged = await runGitCommand(
    ["diff", "--no-color"],
    cwd,
    timeoutMs,
  );
  if (unstaged.exitCode !== 0) return "";
  return unstaged.stdout;
}
