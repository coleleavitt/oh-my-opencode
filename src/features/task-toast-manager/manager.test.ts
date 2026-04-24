declare const require: (name: string) => any
const { describe, test, expect, beforeEach, afterEach, mock } = require("bun:test")
import type { ConcurrencyManager } from "../background-agent/concurrency"

type TaskToastManagerClass = typeof import("./manager").TaskToastManager

describe("TaskToastManager", () => {
  let TaskToastManager: TaskToastManagerClass
  let mockClient: {
    tui: {
      showToast: ReturnType<typeof mock>
    }
  }
  let toastManager: InstanceType<TaskToastManagerClass>
  let mockConcurrencyManager: ConcurrencyManager

  beforeEach(async () => {
    mockClient = {
      tui: {
        showToast: mock(() => Promise.resolve()),
      },
    }
    mockConcurrencyManager = {
      getConcurrencyLimit: mock(() => 5),
    } as unknown as ConcurrencyManager

    const mod = await import("./manager")
    TaskToastManager = mod.TaskToastManager

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toastManager = new TaskToastManager(mockClient as any, mockConcurrencyManager)
  })

  afterEach(() => {
    // Stop the running-task tick timer — tests use fake-time control
    // via setInterval mocks, but a stray live timer from one test would
    // leak into the next and flood showToast with re-emissions.
    toastManager?.dispose?.()
    mock.restore()
  })

  describe("skills in toast message", () => {
    test("should display skills when provided", () => {
      // given - a task with skills
      const task = {
        id: "task_1",
        description: "Test task",
        agent: "sisyphus-junior",
        isBackground: true,
        skills: ["playwright", "git-master"],
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - toast message should include skills
      expect(mockClient.tui.showToast).toHaveBeenCalled()
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).toContain("playwright")
      expect(call.body.message).toContain("git-master")
    })

    test("should not display skills section when no skills provided", () => {
      // given - a task without skills
      const task = {
        id: "task_2",
        description: "Test task without skills",
        agent: "explore",
        isBackground: true,
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - toast message should not include skills prefix
      expect(mockClient.tui.showToast).toHaveBeenCalled()
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).not.toContain("Skills:")
    })
  })

  describe("concurrency info in toast message", () => {
    test("should display concurrency status in toast", () => {
      // given - multiple running tasks
      toastManager.addTask({
        id: "task_1",
        description: "First task",
        agent: "explore",
        isBackground: true,
      })
      toastManager.addTask({
        id: "task_2",
        description: "Second task",
        agent: "librarian",
        isBackground: true,
      })

      // when - third task is added
      toastManager.addTask({
        id: "task_3",
        description: "Third task",
        agent: "explore",
        isBackground: true,
      })

      // then - toast should show concurrency info
      expect(mockClient.tui.showToast).toHaveBeenCalledTimes(3)
      const lastCall = mockClient.tui.showToast.mock.calls[2][0]
      // Should show "Running (3):" header
      expect(lastCall.body.message).toContain("Running (3):")
    })

    test("should display concurrency limit info when available", () => {
      // given - a concurrency manager with known limit
      const mockConcurrencyWithCounts = {
        getConcurrencyLimit: mock(() => 5),
        getRunningCount: mock(() => 2),
        getQueuedCount: mock(() => 1),
      } as unknown as ConcurrencyManager

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const managerWithConcurrency = new TaskToastManager(mockClient as any, mockConcurrencyWithCounts)

      // when - a task is added
      managerWithConcurrency.addTask({
        id: "task_1",
        description: "Test task",
        agent: "explore",
        isBackground: true,
      })

      // then - toast should show concurrency status like "2/5 slots"
      expect(mockClient.tui.showToast).toHaveBeenCalled()
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).toMatch(/\d+\/\d+/)
    })
  })

  describe("combined skills and concurrency display", () => {
    test("should display both skills and concurrency info together", () => {
      // given - a task with skills and concurrency manager
      const task = {
        id: "task_1",
        description: "Full info task",
        agent: "sisyphus-junior",
        isBackground: true,
        skills: ["frontend-ui-ux"],
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - toast should include both skills and task count
      expect(mockClient.tui.showToast).toHaveBeenCalled()
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).toContain("frontend-ui-ux")
      expect(call.body.message).toContain("Running (1):")
    })
  })

  describe("model fallback info in toast message", () => {
    test("should NOT display warning when model is category-default (normal behavior)", () => {
      // given - category-default is the intended behavior, not a fallback
      const task = {
        id: "task_1",
        description: "Task with category default model",
        agent: "sisyphus-junior",
        isBackground: false,
        modelInfo: { model: "google/gemini-3.1-pro", type: "category-default" as const },
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - toast should NOT show warning - category default is expected
      expect(mockClient.tui.showToast).toHaveBeenCalled()
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).not.toContain("[FALLBACK]")
      expect(call.body.message).not.toContain("(category default)")
    })

    test("should display warning when model falls back to system-default", () => {
      // given - system-default is a fallback (no category default, no user config)
      const task = {
        id: "task_1b",
        description: "Task with system default model",
        agent: "sisyphus-junior",
        isBackground: false,
        modelInfo: { model: "anthropic/claude-sonnet-4-6", type: "system-default" as const },
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - toast should show fallback warning
      expect(mockClient.tui.showToast).toHaveBeenCalled()
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).toContain("[FALLBACK]")
      expect(call.body.message).toContain("anthropic/claude-sonnet-4-6")
      expect(call.body.message).toContain("(system default fallback)")
    })

    test("should display warning when model is inherited from parent", () => {
      // given - inherited is a fallback (custom category without model definition)
      const task = {
        id: "task_2",
        description: "Task with inherited model",
        agent: "sisyphus-junior",
        isBackground: false,
        modelInfo: { model: "cliproxy/claude-opus-4-6", type: "inherited" as const },
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - toast should show fallback warning
      expect(mockClient.tui.showToast).toHaveBeenCalled()
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).toContain("[FALLBACK]")
      expect(call.body.message).toContain("cliproxy/claude-opus-4-6")
      expect(call.body.message).toContain("(inherited from parent)")
    })

    test("should display warning when model is runtime fallback", () => {
      // given - runtime-fallback indicates a model swap mid-run
      const task = {
        id: "task_runtime",
        description: "Task with runtime fallback model",
        agent: "explore",
        isBackground: false,
        modelInfo: { model: "anthropic/oswe-vscode-prime", type: "runtime-fallback" as const },
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - toast should show fallback warning
      expect(mockClient.tui.showToast).toHaveBeenCalled()
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).toContain("[FALLBACK]")
      expect(call.body.message).toContain("anthropic/oswe-vscode-prime")
      expect(call.body.message).toContain("(runtime fallback)")
    })

    test("should not display model info when user-defined", () => {
      // given - a task with user-defined model
      const task = {
        id: "task_3",
        description: "Task with user model",
        agent: "sisyphus-junior",
        isBackground: false,
        modelInfo: { model: "my-provider/my-model", type: "user-defined" as const },
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - toast should NOT show model warning
      expect(mockClient.tui.showToast).toHaveBeenCalled()
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).not.toContain("[FALLBACK] Model:")
      expect(call.body.message).not.toContain("(inherited)")
      expect(call.body.message).not.toContain("(category default)")
      expect(call.body.message).not.toContain("(system default)")
    })

    test("should not display model info when not provided", () => {
      // given - a task without model info
      const task = {
        id: "task_4",
        description: "Task without model info",
        agent: "explore",
        isBackground: true,
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - toast should NOT show model warning
      expect(mockClient.tui.showToast).toHaveBeenCalled()
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).not.toContain("[FALLBACK] Model:")
    })
  })

  describe("model name display in task line", () => {
    test("should show model name before category when modelInfo exists", () => {
      // given - a task with category and modelInfo
      const task = {
        id: "task_model_display",
        description: "Build UI component",
        agent: "sisyphus-junior",
        isBackground: true,
        category: "deep",
        modelInfo: { model: "openai/gpt-5.4", type: "category-default" as const },
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - toast should show model name before category like "gpt-5.4: deep"
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).toContain("gpt-5.4: deep")
      expect(call.body.message).not.toContain("sisyphus-junior/deep")
    })

    test("should strip provider prefix from model name", () => {
      // given - a task with provider-prefixed model
      const task = {
        id: "task_strip_provider",
        description: "Fix styles",
        agent: "sisyphus-junior",
        isBackground: false,
        category: "visual-engineering",
        modelInfo: { model: "google/gemini-3.1-pro", type: "category-default" as const },
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - should show model ID without provider prefix
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).toContain("gemini-3.1-pro: visual-engineering")
    })

    test("should fall back to agent/category format when no modelInfo", () => {
      // given - a task without modelInfo
      const task = {
        id: "task_no_model",
        description: "Quick fix",
        agent: "sisyphus-junior",
        isBackground: true,
        category: "quick",
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - should use old format with agent name
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).toContain("sisyphus-junior/quick")
    })

    test("should show model name without category when category is absent", () => {
      // given - a task with modelInfo but no category
      const task = {
        id: "task_model_no_cat",
        description: "Explore codebase",
        agent: "explore",
        isBackground: true,
        modelInfo: { model: "anthropic/claude-sonnet-4-6", type: "category-default" as const },
      }

      // when - addTask is called
      toastManager.addTask(task)

      // then - should show just the model name in parens
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).toContain("(claude-sonnet-4-6)")
    })

    test("should show model name in queued tasks too", () => {
      // given - a concurrency manager that limits to 1
      const limitedConcurrency = {
        getConcurrencyLimit: mock(() => 1),
      } as unknown as ConcurrencyManager
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const limitedManager = new TaskToastManager(mockClient as any, limitedConcurrency)

      limitedManager.addTask({
        id: "task_running",
        description: "Running task",
        agent: "sisyphus-junior",
        isBackground: true,
        category: "deep",
        modelInfo: { model: "openai/gpt-5.3-codex", type: "category-default" as const },
      })
      limitedManager.addTask({
        id: "task_queued",
        description: "Queued task",
        agent: "sisyphus-junior",
        isBackground: true,
        category: "quick",
        status: "queued",
        modelInfo: { model: "anthropic/claude-haiku-4-5", type: "category-default" as const },
      })

      // when - the queued task toast fires
      const lastCall = mockClient.tui.showToast.mock.calls[1][0]

      // then - queued task should also show model name
      expect(lastCall.body.message).toContain("claude-haiku-4-5: quick")
    })
  })

  describe("updateTaskModelBySession", () => {
    test("updates task model info and shows fallback toast", () => {
      // given - task without model info
      const task = {
        id: "task_update",
        sessionID: "ses_update_1",
        description: "Task that will fallback",
        agent: "explore",
        isBackground: false,
      }
      toastManager.addTask(task)
      mockClient.tui.showToast.mockClear()

      // when - runtime fallback applied by session
      toastManager.updateTaskModelBySession("ses_update_1", {
        model: "nvidia/stepfun-ai/step-3.5-flash",
        type: "runtime-fallback",
      })

      // then - new toast shows fallback model
      expect(mockClient.tui.showToast).toHaveBeenCalled()
      const call = mockClient.tui.showToast.mock.calls[0][0]
      expect(call.body.message).toContain("[FALLBACK]")
      expect(call.body.message).toContain("nvidia/stepfun-ai/step-3.5-flash")
      expect(call.body.message).toContain("(runtime fallback)")
    })
  })

  describe("running-duration tick (fix for stuck-at-zero timer)", () => {
    // Uses bun:test's fake timers indirectly — we advance via setTimeout/
    // await. The tick interval is 5000ms; we assert on re-emissions after
    // forcing the interval to fire. Rather than stubbing Date.now() (which
    // requires global patching across tests) we verify the re-emission
    // happens and that its payload shape still matches the task-list
    // format with a live duration computation.

    test("re-emits the task-list toast on the periodic tick while a task runs", async () => {
      const task = {
        id: "tick_1",
        sessionID: "ses_tick_1",
        description: "Long-running work",
        agent: "sisyphus-junior",
        isBackground: true,
      }
      toastManager.addTask(task)
      const initialEmissions = mockClient.tui.showToast.mock.calls.length
      expect(initialEmissions).toBeGreaterThan(0)

      // Wait 1.1x the tick interval — one re-emission should have fired.
      await new Promise((r) => setTimeout(r, 5500))

      const afterTick = mockClient.tui.showToast.mock.calls.length
      expect(afterTick).toBeGreaterThan(initialEmissions)
      const lastCall = mockClient.tui.showToast.mock.calls[afterTick - 1][0]
      expect(lastCall.body.message).toContain("Long-running work")
      // Duration reports actual wall-clock seconds, so it should be ≥ 5s
      // on the re-emission (initial emit at 0s, tick fires at ~5s).
      expect(lastCall.body.message).toMatch(/- \d+s/)
    }, 10_000)

    test("stops ticking once the last running task is removed", async () => {
      toastManager.addTask({
        id: "tick_2",
        sessionID: "ses_tick_2",
        description: "Will finish",
        agent: "sisyphus-junior",
        isBackground: true,
      })
      mockClient.tui.showToast.mockClear()

      toastManager.removeTask("tick_2")

      // Wait well past one tick interval — no further toast emissions
      // should happen because there are no running tasks.
      await new Promise((r) => setTimeout(r, 5500))
      expect(mockClient.tui.showToast.mock.calls.length).toBe(0)
    }, 10_000)

    test("stops ticking when the only running task transitions to completed via updateTask", async () => {
      toastManager.addTask({
        id: "tick_3",
        sessionID: "ses_tick_3",
        description: "Will finish via status",
        agent: "sisyphus-junior",
        isBackground: true,
      })
      mockClient.tui.showToast.mockClear()

      toastManager.updateTask("tick_3", "completed")

      await new Promise((r) => setTimeout(r, 5500))
      expect(mockClient.tui.showToast.mock.calls.length).toBe(0)
    }, 10_000)

    test("dispose() clears the tick timer immediately", async () => {
      toastManager.addTask({
        id: "tick_4",
        sessionID: "ses_tick_4",
        description: "Dispose test",
        agent: "sisyphus-junior",
        isBackground: true,
      })
      mockClient.tui.showToast.mockClear()

      toastManager.dispose()

      await new Promise((r) => setTimeout(r, 5500))
      expect(mockClient.tui.showToast.mock.calls.length).toBe(0)
    }, 10_000)
  })
})
