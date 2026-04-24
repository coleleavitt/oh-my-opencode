/**
 * Worktree isolation for delegated tasks.
 *
 * Ported from cc119's `isolation: "worktree"` pattern
 * (cli.2.1.119.aligned.js:309292, :309433-309437, :309789). When a task
 * is dispatched with run_in_worktree=true, the agent executes inside a
 * fresh `git worktree add`-ed directory on its own branch. If the task
 * produces no commits, the worktree is auto-removed; if it produces
 * commits, the path and branch are returned so the parent can pick them
 * up deliberately.
 *
 * Scoped to sync-only delegation in this version. Background tasks
 * outlive the delegate-task call and need more careful lifecycle tying
 * to session state — deferred.
 */

import { execFileSync } from "node:child_process"
import { dirname, basename, join } from "node:path"
import { randomBytes } from "node:crypto"
import { log } from "../../shared"

export interface WorktreeResult {
  /** True if the agent produced at least one new commit (or the base HEAD moved). */
  hasChanges: boolean
  /** Absolute path to the worktree. Deleted when hasChanges=false. */
  worktreePath: string
  /** Branch name the worktree was created on. */
  branch: string
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim()
}

function tryGit(args: string[], cwd: string): string | null {
  try {
    return git(args, cwd)
  } catch {
    return null
  }
}

/**
 * Generate a unique worktree path + branch name slug for a given label.
 * The worktree lives as a sibling of the repo root (so `git worktree add`
 * doesn't pollute the repo itself).
 */
function makeNames(baseDir: string, label: string): { worktreePath: string; branch: string } {
  const id = randomBytes(3).toString("hex")
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "task"
  const repoRoot = tryGit(["rev-parse", "--show-toplevel"], baseDir) || baseDir
  const siblingDir = dirname(repoRoot)
  const repoName = basename(repoRoot)
  const worktreePath = join(siblingDir, `${repoName}-omo-wt-${safeLabel}-${id}`)
  const branch = `omo-wt/${safeLabel}-${id}`
  return { worktreePath, branch }
}

/**
 * Create a git worktree off the current HEAD of `baseDir` on a fresh branch.
 * Returns { worktreePath, branch, baseCommit }. Throws if baseDir is not
 * inside a git repo.
 */
export function createWorktree(baseDir: string, label: string): { worktreePath: string; branch: string; baseCommit: string } {
  const baseCommit = git(["rev-parse", "HEAD"], baseDir)
  const { worktreePath, branch } = makeNames(baseDir, label)
  git(["worktree", "add", worktreePath, "-b", branch, "HEAD"], baseDir)
  log("[delegate-task/worktree] created", { worktreePath, branch, baseCommit })
  return { worktreePath, branch, baseCommit }
}

/**
 * Returns true if the worktree's branch HEAD differs from baseCommit OR
 * the working tree / index is dirty (uncommitted changes still count as
 * real output from the agent).
 */
export function worktreeHasChanges(worktreePath: string, baseCommit: string): boolean {
  const currentHead = tryGit(["rev-parse", "HEAD"], worktreePath)
  if (currentHead !== null && currentHead !== baseCommit) return true

  const status = tryGit(["status", "--porcelain"], worktreePath)
  return !!(status && status.length > 0)
}

/**
 * Force-remove the worktree and delete its branch. Safe to call even if
 * the worktree is dirty — the point is we already decided to discard.
 */
export function removeWorktree(baseDir: string, worktreePath: string, branch: string): void {
  tryGit(["worktree", "remove", "--force", worktreePath], baseDir)
  tryGit(["branch", "-D", branch], baseDir)
  log("[delegate-task/worktree] removed", { worktreePath, branch })
}

/**
 * Wrap an async operation in worktree lifecycle:
 *   - create worktree on fresh branch
 *   - run fn(worktreePath)
 *   - if fn produced no changes (commits or dirty wt), remove the worktree
 *   - always re-throw fn's errors; always attempt cleanup on error
 *
 * On success, returns the fn's result plus the WorktreeResult so the
 * caller can surface the branch/path to the user when hasChanges=true.
 */
export async function withWorktree<T>(
  baseDir: string,
  label: string,
  fn: (worktreePath: string) => Promise<T>,
): Promise<{ result: T; worktree: WorktreeResult }> {
  const { worktreePath, branch, baseCommit } = createWorktree(baseDir, label)
  let result: T
  try {
    result = await fn(worktreePath)
  } catch (err) {
    // Agent failed — check if it left behind anything before deciding
    // whether to preserve the worktree for post-mortem.
    const hasChanges = worktreeHasChanges(worktreePath, baseCommit)
    if (!hasChanges) removeWorktree(baseDir, worktreePath, branch)
    else log("[delegate-task/worktree] error path left dirty worktree for inspection", { worktreePath, branch })
    throw err
  }

  const hasChanges = worktreeHasChanges(worktreePath, baseCommit)
  if (!hasChanges) removeWorktree(baseDir, worktreePath, branch)
  return { result, worktree: { hasChanges, worktreePath, branch } }
}
