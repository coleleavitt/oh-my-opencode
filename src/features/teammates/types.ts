/**
 * Teammate = a named, addressable, long-running subagent the parent can
 * continue talking to across turns via `send_message_to_teammate`.
 *
 * Scope: per-parent-session (a teammate only exists in the context of
 * the parent session that spawned it). On `session.deleted` for the
 * parent, all its teammates are cleared.
 *
 * See src/features/teammates/DESIGN.md for the full design + the 4
 * decisions this implementation locks in.
 */

export type TeammateStatus =
  | "pending"    // spawned, agent session created, no first turn yet
  | "running"    // actively processing a turn
  | "idle"       // finished a turn, awaiting next message
  | "error"      // last turn failed; still addressable for retry
  | "dismissed"  // dismiss_teammate called; removed from registry

export interface TeammateEntry {
  /** User-chosen stable name (e.g. "researcher"). Unique per parent session. */
  name: string
  /** OpenCode session ID backing this teammate. */
  sessionID: string
  /** Agent type (e.g. "explore", "sisyphus-junior"). */
  agent: string
  /** Current lifecycle state. */
  status: TeammateStatus
  /** Parent session that owns this teammate. */
  parentSessionID: string
  /** ms since epoch of the most recent status change or message send. */
  lastActivityAt: number
  /** ms since epoch of registration. */
  createdAt: number
  /** Last peer DM content (≤120 chars, truncated). */
  lastMessage?: string
  /** Who sent the last peer DM (teammate name or "parent"). */
  lastMessageFrom?: string

  // --- Shutdown approval protocol (Feature 4) ---
  /** True while teammate awaits leader's approve/reject decision. */
  awaitingLeaderApproval?: boolean
  /** Reason the teammate gave for requesting shutdown. */
  shutdownReason?: string

  // --- Task status updates (Feature 5) ---
  /** Teammate-reported task lifecycle state. */
  taskStatus?: "in_progress" | "completed" | "blocked" | "needs_review"
  /** One-line headline (≤200 chars). */
  taskSummary?: string
  /** 0-100 completion percentage. */
  taskProgress?: number
  /** Path to team shared memory directory for this teammate's parent group. */
  teamMemoryDir?: string
}

export type RegisterResult =
  | { kind: "registered"; entry: TeammateEntry; reused: false }
  | { kind: "reused"; entry: TeammateEntry; reused: true }
  | { kind: "capacity_exceeded"; limit: number; current: number }

export interface RegisterInput {
  name: string
  sessionID: string
  agent: string
  parentSessionID: string
  /** Per-parent cap. Exceeded check is done against the parent's current count, not global. */
  maxConcurrent: number
}

export interface TeammateRegistry {
  /**
   * Register a new teammate. If (parentSessionID, name) already exists,
   * returns the existing entry with kind="reused" (design decision: name
   * collision = user intent to talk to the same teammate again). If the
   * parent is at capacity and this is a new name, returns
   * kind="capacity_exceeded".
   */
  register(input: RegisterInput): RegisterResult

  /** Resolve (parent, name) → entry. Undefined if unknown. */
  get(parentSessionID: string, name: string): TeammateEntry | undefined

  /** All teammates for a parent session, in insertion order. */
  list(parentSessionID: string): TeammateEntry[]

  /**
   * Update lastActivityAt (always) and status (if provided). Returns the
   * updated entry, or undefined if the teammate is unknown.
   */
  touch(parentSessionID: string, name: string, status?: TeammateStatus): TeammateEntry | undefined

  /**
   * Remove a teammate. Returns the removed entry or undefined if it
   * didn't exist. Does NOT abort the underlying session — that's the
   * caller's job (the dismiss_teammate tool will abort before removing).
   */
  dismiss(parentSessionID: string, name: string): TeammateEntry | undefined

  /**
   * Record a peer DM on a teammate entry. Updates lastMessage (truncated
   * to 120 chars) and lastMessageFrom. Returns the updated entry.
   */
  recordMessage(parentSessionID: string, name: string, from: string, message: string): TeammateEntry | undefined

  /**
   * Remove all teammates for a parent session. Returns the count
   * removed. Used on session.deleted events.
   */
  clearParent(parentSessionID: string): number

  /**
   * Reverse-lookup: find the teammate entry whose sessionID matches.
   * Returns { parentSessionID, entry } or undefined.
   */
  findBySessionID(sessionID: string): { parentSessionID: string; entry: TeammateEntry } | undefined

  // --- Shutdown approval protocol ---
  /** Teammate requests permission to shut down. Sets awaitingLeaderApproval + idle. */
  requestShutdown(parentSessionID: string, name: string, reason: string): TeammateEntry | undefined
  /** Leader approves — returns entry for caller to dismiss. */
  approveShutdown(parentSessionID: string, name: string): TeammateEntry | undefined
  /** Leader rejects — clears approval flag, teammate continues. */
  rejectShutdown(parentSessionID: string, name: string): TeammateEntry | undefined

  // --- Task status updates ---
  /** Teammate pushes a task status update. */
  updateTask(parentSessionID: string, name: string, update: {
    status: "in_progress" | "completed" | "blocked" | "needs_review"
    summary: string
    progress?: number
  }): TeammateEntry | undefined

  /** Test introspection only. */
  snapshot(): readonly TeammateEntry[]
}
