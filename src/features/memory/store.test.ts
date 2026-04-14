import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { sanitizeCwd, getMemoryDir, saveMemory, deleteMemory, listMemories, loadMemories } from "./store"

const TEST_CWD = "/home/testuser/projects/my-project"
let testBase: string

beforeEach(() => {
  testBase = fs.mkdtempSync(path.join(os.tmpdir(), "omo-memory-test-"))
  process.env.OVERRIDE_MEMORY_BASE = testBase
})

afterEach(() => {
  fs.rmSync(testBase, { recursive: true, force: true })
  delete process.env.OVERRIDE_MEMORY_BASE
})

describe("sanitizeCwd", () => {
  it("strips leading slash and replaces separators", () => {
    expect(sanitizeCwd("/home/user/project")).toBe("home_user_project")
  })

  it("lowercases", () => {
    expect(sanitizeCwd("/Home/USER/Proj")).toBe("home_user_proj")
  })

  it("truncates at 200 chars", () => {
    const long = "/" + "a".repeat(300)
    expect(sanitizeCwd(long).length).toBeLessThanOrEqual(200)
  })
})

describe("getMemoryDir", () => {
  it("different CWDs produce different dirs", () => {
    const a = getMemoryDir("/home/user/project-a")
    const b = getMemoryDir("/home/user/project-b")
    expect(a).not.toBe(b)
  })
})

describe("saveMemory + listMemories", () => {
  it("saves and lists a memory", () => {
    const filename = saveMemory(TEST_CWD, "prefers-bun", "Uses bun over npm", "feedback", "Use bun.\n**Why:** Monorepo compat.\n**How to apply:** All installs.")
    expect(filename).toBe("prefers-bun.md")

    const memories = listMemories(TEST_CWD)
    expect(memories).toHaveLength(1)
    expect(memories[0].name).toBe("prefers-bun")
    expect(memories[0].type).toBe("feedback")
    expect(memories[0].description).toBe("Uses bun over npm")
  })

  it("saves multiple memories", () => {
    saveMemory(TEST_CWD, "user-is-ds", "User is a data scientist", "user", "Data scientist focused on logging.")
    saveMemory(TEST_CWD, "merge-freeze", "Merge freeze after Thursday", "project", "Freeze begins 2026-03-05.")
    expect(listMemories(TEST_CWD)).toHaveLength(2)
  })
})

describe("deleteMemory", () => {
  it("deletes an existing memory", () => {
    saveMemory(TEST_CWD, "test-mem", "Test", "user", "Body.")
    expect(listMemories(TEST_CWD)).toHaveLength(1)
    const deleted = deleteMemory(TEST_CWD, "test-mem.md")
    expect(deleted).toBe(true)
    expect(listMemories(TEST_CWD)).toHaveLength(0)
  })

  it("returns false for non-existent memory", () => {
    expect(deleteMemory(TEST_CWD, "does-not-exist.md")).toBe(false)
  })
})

describe("loadMemories", () => {
  it("returns empty string when no memories", () => {
    expect(loadMemories(TEST_CWD)).toBe("")
  })

  it("returns XML block with memories", () => {
    saveMemory(TEST_CWD, "pref-bun", "Prefers bun", "feedback", "Use bun.")
    const result = loadMemories(TEST_CWD)
    expect(result).toContain("<memories>")
    expect(result).toContain("<memory")
    expect(result).toContain("pref-bun")
    expect(result).toContain("Use bun.")
    expect(result).toContain("</memories>")
  })
})
