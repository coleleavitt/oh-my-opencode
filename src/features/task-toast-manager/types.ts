import type { ModelSource } from "../../shared/model-resolver"

export type TaskStatus = "running" | "queued" | "completed" | "error"

export interface ModelFallbackInfo {
  model: string
  type: "user-defined" | "inherited" | "category-default" | "system-default" | "runtime-fallback"
  source?: ModelSource
}

export interface TrackedTask {
  id: string
  sessionID?: string
  description: string
  agent: string
  status: TaskStatus
  startedAt: Date
  isBackground: boolean
  category?: string
  skills?: string[]
  modelInfo?: ModelFallbackInfo
}

export interface TaskToastOptions {
  title: string
  message: string
  variant: "info" | "success" | "warning" | "error"
  duration?: number
}

export interface TaskStartedEvent {
  task_id: string
  description: string
  agent_name: string
  is_background: boolean
  parent_session_id: string
}

export interface TaskCompletedEvent {
  task_id: string
  description: string
  agent_name: string
  status: "completed" | "failed" | "killed"
  duration_ms?: number
  error?: string
}

export interface TaskProgressEvent {
  task_id: string
  description: string
  last_tool_name?: string
  summary?: string
  elapsed_ms: number
}

export interface TaskUpdatedEvent {
  task_id: string
  patch: {
    status?: "running" | "completed" | "failed" | "killed"
    description?: string
    end_time?: number
    error?: string
    is_backgrounded?: boolean
  }
}
