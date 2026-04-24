/// <reference types="bun-types" />

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createWorktree, worktreeHasChanges, removeWorktree, withWorktree } from "./worktree"

/** Create an isolated bare-ish git repo with one commit, return its path. */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "omo-wt-test-"))
  execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "ignore" })
  execFileSync("git", ["config", "user.email", "test@test"], { cwd: dir, stdio: "ignore" })
  execFileSync("git", ["config", "user.name", "test"], { cwd: dir, stdio: "ignore" })
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: dir, stdio: "ignore" })
  writeFileSync(join(dir, "README.md"), "# test\n")
  execFileSync("git", ["add", "."], { cwd: dir, stdio: "ignore" })
  execFileSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "ignore" })
  return dir
}

function gitOut(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim()
}

describe("worktree helpers", () => {
  let repo: string
  const cleanup: string[] = []

  beforeEach(() => {
    repo = makeRepo()
    cleanup.push(repo)
  })

  afterEach(() => {
    for (const p of cleanup.splice(0)) {
      try { rmSync(p, { recursive: true, force: true }) } catch {}
    }
  })

  it("createWorktree creates a worktree on a fresh branch at HEAD", () => {
    const { worktreePath, branch, baseCommit } = createWorktree(repo, "my-task")
    cleanup.push(worktreePath)
    expect(branch).toMatch(/^omo-wt\/my-task-[0-9a-f]{6}$/)
    expect(baseCommit).toMatch(/^[0-9a-f]{40}$/)
    // the worktree exists and is on the new branch
    const wtBranch = gitOut(["rev-parse", "--abbrev-ref", "HEAD"], worktreePath)
    expect(wtBranch).toBe(branch)
  })

  it("worktreeHasChanges returns false on a pristine worktree", () => {
    const { worktreePath, baseCommit } = createWorktree(repo, "clean")
    cleanup.push(worktreePath)
    expect(worktreeHasChanges(worktreePath, baseCommit)).toBe(false)
  })

  it("worktreeHasChanges returns true when working tree is dirty", () => {
    const { worktreePath, baseCommit } = createWorktree(repo, "dirty")
    cleanup.push(worktreePath)
    writeFileSync(join(worktreePath, "new.txt"), "hi")
    expect(worktreeHasChanges(worktreePath, baseCommit)).toBe(true)
  })

  it("worktreeHasChanges returns true when a new commit is made", () => {
    const { worktreePath, baseCommit } = createWorktree(repo, "committed")
    cleanup.push(worktreePath)
    writeFileSync(join(worktreePath, "new.txt"), "hi")
    execFileSync("git", ["add", "."], { cwd: worktreePath })
    execFileSync("git", ["commit", "-m", "wt commit"], { cwd: worktreePath })
    expect(worktreeHasChanges(worktreePath, baseCommit)).toBe(true)
  })

  it("removeWorktree cleans up the worktree and branch", () => {
    const { worktreePath, branch } = createWorktree(repo, "goodbye")
    removeWorktree(repo, worktreePath, branch)
    const listed = gitOut(["worktree", "list", "--porcelain"], repo)
    expect(listed).not.toContain(worktreePath)
    const branches = gitOut(["branch", "--list", branch], repo)
    expect(branches).toBe("")
  })

  it("withWorktree removes the worktree on no-change success path", async () => {
    const { worktree } = await withWorktree(repo, "noop", async (wt) => {
      // agent does nothing
      void wt
      return "done"
    })
    expect(worktree.hasChanges).toBe(false)
    // worktree should be gone
    const listed = gitOut(["worktree", "list", "--porcelain"], repo)
    expect(listed).not.toContain(worktree.worktreePath)
  })

  it("withWorktree preserves the worktree when the agent produces changes", async () => {
    const { result, worktree } = await withWorktree(repo, "changes", async (wt) => {
      writeFileSync(join(wt, "output.txt"), "agent wrote this")
      return 42
    })
    cleanup.push(worktree.worktreePath)
    expect(result).toBe(42)
    expect(worktree.hasChanges).toBe(true)
    const listed = gitOut(["worktree", "list", "--porcelain"], repo)
    expect(listed).toContain(worktree.worktreePath)
  })

  it("withWorktree re-throws agent errors and removes the worktree when it's clean", async () => {
    const boom = new Error("agent failed")
    let capturedPath: string | undefined
    await expect(
      withWorktree(repo, "failboat", async (wt) => {
        capturedPath = wt
        throw boom
      }),
    ).rejects.toThrow("agent failed")

    expect(capturedPath).toBeDefined()
    const listed = gitOut(["worktree", "list", "--porcelain"], repo)
    expect(listed).not.toContain(capturedPath!)
  })

  it("withWorktree preserves a dirty worktree when the agent errors mid-work", async () => {
    let capturedPath: string | undefined
    await expect(
      withWorktree(repo, "errbutdirty", async (wt) => {
        capturedPath = wt
        writeFileSync(join(wt, "partial.txt"), "in-progress")
        throw new Error("bailed after partial write")
      }),
    ).rejects.toThrow("bailed after partial write")

    expect(capturedPath).toBeDefined()
    cleanup.push(capturedPath!)
    const listed = gitOut(["worktree", "list", "--porcelain"], repo)
    expect(listed).toContain(capturedPath!)
  })
})
