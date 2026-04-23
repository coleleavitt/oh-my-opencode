export const ARGUS_OUTPUT_FIXTURE = `# Argus Code Review Report

## Finding #1: Null pointer dereference on auth token refresh

**Priority**: P-1 (BLOCKER)

**Metrics**:
- Impact: 🔴 CRITICAL — Auth bypass possible; null token treated as valid by downstream check
- Trigger: 🔴 ALWAYS — Runs on every authenticated request after token expiry
- Blast Radius: 🟠 MODULE — Propagates across auth/, api/, session/ modules
- Fix Effort: 🟢 TRIVIAL — Add null check before dereference
- Confidence: 🔴 CERTAIN — Deterministic null pointer (token.refresh() can return null per line 42)

**Location**: \`src/auth/token-manager.ts:67\`

**Issue**: \`refreshed.accessToken.toString()\` assumes refreshed is non-null, but refreshToken() returns null on network failure (see line 42). Any subsequent request after a failed refresh crashes the server process.

**Recommendation**: Add explicit null check before line 67:

\`\`\`typescript
if (!refreshed) {
  throw new TokenRefreshError("Token refresh returned null");
}
\`\`\`

**Rationale**: Server crashes on transient network errors, converting a recoverable failure into a downtime event. Users lose their session state.

---

## Finding #2: Race condition in cache eviction

**Priority**: P-3 (MEDIUM)

**Metrics**:
- Impact: 🟡 MEDIUM — Stale data served under load; no data corruption
- Trigger: 🟡 RARE — Only under concurrent evict + read with <10ms window
- Blast Radius: 🟡 FILE — Contained to cache-manager.ts
- Fix Effort: 🟡 MODERATE — Add mutex around eviction loop (~1 hr)
- Confidence: 🟠 HIGH — Strong evidence: no locking observed on shared map

**Location**: \`src/cache/manager.ts:142-158\`

**Issue**: The eviction loop iterates \`this.entries\` without locking while read operations can concurrently access the same map. TOCTOU window is small but reachable under load.

**Recommendation**: Wrap eviction in \`await this.mutex.runExclusive(() => {...})\` or use an atomic compare-and-swap pattern.

**Rationale**: Stale reads degrade cache consistency guarantees. Not a correctness bug for idempotent reads, but can cause ghost writes if writes race with eviction.
`;
