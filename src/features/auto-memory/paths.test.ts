import { describe, it, expect } from "bun:test"
import { homedir } from "node:os"
import { join } from "node:path"
import { resolveMemoryBaseDir } from "./paths"

describe("resolveMemoryBaseDir", () => {
  describe("#given scope=user", () => {
    it("#then resolves to ~/.claude/agent-memory/<agentType>", () => {
      const result = resolveMemoryBaseDir({
        scope: "user",
        agentType: "sisyphus",
        projectDir: "/home/user/project",
      })
      expect(result).toBe(join(homedir(), ".claude", "agent-memory", "sisyphus"))
    })
  })

  describe("#given scope=project", () => {
    it("#then resolves to <projectDir>/.claude/agent-memory/<agentType>", () => {
      const result = resolveMemoryBaseDir({
        scope: "project",
        agentType: "oracle",
        projectDir: "/home/user/my-project",
      })
      expect(result).toBe(
        join("/home/user/my-project", ".claude", "agent-memory", "oracle"),
      )
    })
  })

  describe("#given scope=local", () => {
    it("#then resolves to <projectDir>/.claude/agent-memory-local/<agentType>", () => {
      const result = resolveMemoryBaseDir({
        scope: "local",
        agentType: "code-reviewer",
        projectDir: "/tmp/workspace",
      })
      expect(result).toBe(
        join("/tmp/workspace", ".claude", "agent-memory-local", "code-reviewer"),
      )
    })
  })

  describe("#given configuredDir is set", () => {
    it("#then uses configuredDir instead of default path", () => {
      const result = resolveMemoryBaseDir({
        scope: "user",
        agentType: "sisyphus",
        projectDir: "/home/user/project",
        configuredDir: "/custom/memory/dir",
      })
      expect(result).toBe(join("/custom/memory/dir", "sisyphus"))
    })

    it("#when configuredDir starts with ~/ #then expands home directory", () => {
      const result = resolveMemoryBaseDir({
        scope: "project",
        agentType: "oracle",
        projectDir: "/home/user/project",
        configuredDir: "~/my-memories",
      })
      expect(result).toBe(join(homedir(), "my-memories", "oracle"))
    })

    it("#when configuredDir is absolute #then uses it directly", () => {
      const result = resolveMemoryBaseDir({
        scope: "local",
        agentType: "explore",
        projectDir: "/home/user/project",
        configuredDir: "/var/agent-memory",
      })
      expect(result).toBe(join("/var/agent-memory", "explore"))
    })
  })

  describe("#given different agentTypes", () => {
    it("#then each agentType gets its own subdirectory", () => {
      const base = { scope: "user" as const, projectDir: "/project" }
      const sisyphus = resolveMemoryBaseDir({ ...base, agentType: "sisyphus" })
      const oracle = resolveMemoryBaseDir({ ...base, agentType: "oracle" })
      expect(sisyphus).not.toBe(oracle)
      expect(sisyphus).toContain("sisyphus")
      expect(oracle).toContain("oracle")
    })
  })
})
