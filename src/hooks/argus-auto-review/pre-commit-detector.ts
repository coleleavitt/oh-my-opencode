export interface GitCommitDetection {
  isCommit: boolean;
  hasNoVerify: boolean;
  isAmend: boolean;
  raw: string;
}

const SHELL_SPLIT = /\s*(?:&&|\|\||;)\s*/;
const COMMIT_PATTERN = /^git\s+commit(\s|$)/;
const NO_VERIFY_LONG = /--no-verify(\s|$)/;
const NO_VERIFY_SHORT = /(^|\s)-(?!-)[a-zA-Z]*n[a-zA-Z]*(\s|$)/;
const AMEND_PATTERN = /--amend(\s|$)/;
const ECHO_PREFIX = /^(echo|printf|true|:)\s/;
const SUBSHELL_WRAP = /^[$`(]/;

const NOT_COMMIT: GitCommitDetection = {
  isCommit: false,
  hasNoVerify: false,
  isAmend: false,
  raw: "",
};

function isCommitSegment(segment: string): boolean {
  const trimmed = segment.trim();
  if (ECHO_PREFIX.test(trimmed) || SUBSHELL_WRAP.test(trimmed)) return false;
  return COMMIT_PATTERN.test(trimmed);
}

export function detectGitCommit(command: string): GitCommitDetection {
  if (!command.trim()) return { ...NOT_COMMIT, raw: command };

  const segments = command.split(SHELL_SPLIT);
  const commitSegment = segments.find((s) => isCommitSegment(s));

  if (!commitSegment) return { ...NOT_COMMIT, raw: command };

  const trimmed = commitSegment.trim();
  const padded = ` ${trimmed}`;

  return {
    isCommit: true,
    hasNoVerify:
      NO_VERIFY_LONG.test(trimmed) || NO_VERIFY_SHORT.test(padded),
    isAmend: AMEND_PATTERN.test(trimmed),
    raw: command,
  };
}
