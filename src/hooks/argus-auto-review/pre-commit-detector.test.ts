import { describe, it, expect } from "bun:test";
import { detectGitCommit } from "./pre-commit-detector";

describe("detectGitCommit", () => {
  describe("#given a simple git commit command", () => {
    it("detects bare git commit", () => {
      // given
      const command = "git commit";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
      expect(result.hasNoVerify).toBe(false);
      expect(result.isAmend).toBe(false);
      expect(result.raw).toBe("git commit");
    });

    it("detects git commit with message flag", () => {
      // given
      const command = "git commit -m 'msg'";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
      expect(result.hasNoVerify).toBe(false);
      expect(result.isAmend).toBe(false);
    });

    it("handles leading and trailing whitespace", () => {
      // given
      const command = "  git commit  ";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
    });
  });

  describe("#given amend flags", () => {
    it("detects --amend", () => {
      // given
      const command = "git commit --amend";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
      expect(result.isAmend).toBe(true);
    });

    it("detects --amend with --no-edit", () => {
      // given
      const command = "git commit --amend --no-edit";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
      expect(result.isAmend).toBe(true);
    });
  });

  describe("#given no-verify flags", () => {
    it("detects --no-verify long form", () => {
      // given
      const command = "git commit --no-verify -m 'bypass'";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
      expect(result.hasNoVerify).toBe(true);
    });

    it("detects -n short form", () => {
      // given
      const command = "git commit -n -m 'bypass short form'";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
      expect(result.hasNoVerify).toBe(true);
    });

    it("detects combined short flags like -an (all + no-verify)", () => {
      // given
      const command = "git commit -an -m 'msg'";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
      expect(result.hasNoVerify).toBe(true);
    });

    it("detects combined short flags like -anm (all + no-verify + message)", () => {
      // given
      const command = "git commit -anm 'msg'";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
      expect(result.hasNoVerify).toBe(true);
    });

    it("does not false-positive on short flags without n like -am", () => {
      // given
      const command = "git commit -am 'msg'";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
      expect(result.hasNoVerify).toBe(false);
    });
  });

  describe("#given non-commit git commands", () => {
    it("rejects git log", () => {
      // when
      const result = detectGitCommit("git log");

      // then
      expect(result.isCommit).toBe(false);
    });

    it("rejects git status", () => {
      // when
      const result = detectGitCommit("git status");

      // then
      expect(result.isCommit).toBe(false);
    });

    it("rejects git commitfoo (word boundary)", () => {
      // when
      const result = detectGitCommit("git commitfoo");

      // then
      expect(result.isCommit).toBe(false);
    });
  });

  describe("#given echo/printf wrapping", () => {
    it("rejects echo git commit", () => {
      // when
      const result = detectGitCommit("echo git commit");

      // then
      expect(result.isCommit).toBe(false);
    });

    it("rejects printf git commit", () => {
      // when
      const result = detectGitCommit("printf git commit");

      // then
      expect(result.isCommit).toBe(false);
    });
  });

  describe("#given composite shell commands", () => {
    it("detects git commit after && operator", () => {
      // given
      const command = "cd /path && git commit -m 'msg'";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
    });

    it("detects git commit after ; operator", () => {
      // given
      const command = "git status; git commit -m 'x'";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
    });

    it("detects git commit after || operator", () => {
      // given
      const command = "git status || git commit";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
    });

    it("detects flags in composite commands", () => {
      // given
      const command = "git add . && git commit --amend --no-verify -m 'fix'";

      // when
      const result = detectGitCommit(command);

      // then
      expect(result.isCommit).toBe(true);
      expect(result.isAmend).toBe(true);
      expect(result.hasNoVerify).toBe(true);
    });
  });

  describe("#given empty or blank input", () => {
    it("rejects empty string", () => {
      // when
      const result = detectGitCommit("");

      // then
      expect(result.isCommit).toBe(false);
    });

    it("rejects whitespace-only string", () => {
      // when
      const result = detectGitCommit("   ");

      // then
      expect(result.isCommit).toBe(false);
    });
  });

  describe("#given subshell wrapping", () => {
    it("rejects $(...) subshell evaluation", () => {
      // when
      const result = detectGitCommit("$(git commit -m 'sneaky')");

      // then
      expect(result.isCommit).toBe(false);
    });

    it("rejects backtick subshell evaluation", () => {
      // when
      const result = detectGitCommit("`git commit -m 'sneaky'`");

      // then
      expect(result.isCommit).toBe(false);
    });
  });
});
