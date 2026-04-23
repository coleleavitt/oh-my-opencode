import type { BuiltinSkill } from "../types";

export const argusSecuritySkill: BuiltinSkill = {
  name: "argus-security",
  description:
    "Argus security-focused code review. Scans for OWASP Top 10 vulnerabilities (injection, auth bypass, secrets exposure, XSS, deserialization). Auto-promotes security findings to P-1 BLOCKER regardless of Trigger axis. Higher confidence threshold (>=HIGH only). MUST USE for security-sensitive changes (auth code, API endpoints, crypto, file operations). Triggers: 'security review', 'argus security', 'audit for vulns', 'check for security issues', 'scan for vulnerabilities'.",
  agent: "code-reviewer",
  template: `# Argus Security Audit — OWASP-aligned

You are invoking the Argus code reviewer in security-focused mode. Findings have STRICTER thresholds:
- Confidence threshold: HIGH minimum (no MEDIUM-confidence security findings)
- Auto-promote to P-1 BLOCKER: All Security-category findings regardless of Trigger axis
- Focus: OWASP Top 10 + CWE Top 25

## Step 1: Attack Surface Discovery (run in parallel via Bash)

\`\`\`bash
# Find hardcoded secrets
rg -i "(password|secret|api_key|apikey|token|credential|private_key)\\s*[:=]" --type-not lock

# Find SQL queries (injection risk)
rg "(SELECT|INSERT|UPDATE|DELETE|query|execute).*(\\+|format|f\\"|\\\${)" -i

# Find command execution
rg "(exec|spawn|system|shell|popen|subprocess|child_process)"

# Find user input handling
rg "(req\\.body|req\\.query|req\\.params|request\\.|user_input|stdin)"

# Find auth-related code
rg "(authenticate|authorize|login|logout|session|jwt|token)" -i

# Find crypto usage
rg "(encrypt|decrypt|hash|md5|sha1|sha256|bcrypt|scrypt)" -i

# Find file operations with user input
rg "(readFile|writeFile|open\\(|fopen|unlink|rmdir)"

# Find deserialization
rg "(JSON\\.parse|pickle|yaml\\.load|deserialize|unmarshal)"

# Find eval/dynamic code
rg "(eval|Function\\(|new Function|vm\\.run)"

# Find changed files
git diff --name-only HEAD~1
\`\`\`

## Step 2: Vulnerability Categories to Examine

### Injection (most common P-1)
- SQL injection (string concat or template literal in queries)
- Command injection (user input in shell commands)
- Code injection (eval, Function constructor, vm.run)
- Path traversal (user input in file paths without sanitization)
- XXE / XML External Entity
- Template injection
- NoSQL injection

### Authentication & Authorization
- Missing auth checks on sensitive endpoints
- Weak token validation (no signature check, ignored expiration)
- Session fixation vulnerabilities
- IDOR (Insecure Direct Object Reference)
- Privilege escalation paths
- Role check bypass

### Secrets & Crypto
- Hardcoded API keys, passwords, tokens
- Secrets in logs or error messages
- Weak algorithms (MD5, SHA1 for security)
- ECB mode encryption
- Predictable IVs or salts
- Missing integrity checks

### Data Exposure
- Sensitive data in URLs (logged by reverse proxies)
- Verbose error messages (stack traces, SQL errors)
- Debug endpoints in production
- PII in logs

## Step 3: Delegate to Argus Subagent

\`\`\`
task(
  subagent_type="code-reviewer",
  description="Argus security audit (OWASP-aligned)",
  prompt="SECURITY-FOCUSED REVIEW MODE. Apply STRICT criteria: \\n- Confidence threshold: HIGH minimum (no MEDIUM-confidence security findings) \\n- Auto-promote to P-1: All Security-category findings regardless of Trigger \\n- Focus: OWASP Top 10 + CWE Top 25 \\n\\nUse the 5-axis taxonomy from your system prompt. For each finding, the Issue field MUST include: (a) the vulnerability category, (b) attack scenario, (c) exploit path or PoC sketch. \\n\\nAttack surface discovery results: \\n[paste rg output] \\n\\nDiff: \\n[paste git diff]"
)
\`\`\`

## Step 4: Present Security Audit Report

\`\`\`
## Security Audit Summary
**Scope**: {files reviewed}

### Findings by Severity
- P-1 BLOCKER: {count} (security vulnerabilities — must fix before merge)
- P-2 HIGH: {count} (significant risk)
- P-3 MEDIUM: {count} (defense-in-depth)
- P-4 LOW: {count} (best practice violations)

### Critical Findings (P-1)
[List each P-1 finding with attack scenario + exploit path]

### Recommendation
{PASS / FAIL / CONDITIONAL PASS with required fixes}
\`\`\`

## Critical Constraints

- DO NOT skip the code-reviewer subagent delegation
- DO NOT modify files or run write operations
- DO NOT report theoretical issues without exploit paths
- DO NOT downgrade verified Security-category findings below P-1`,
};
