import { collectGitDiffStats } from "../../shared/git-worktree/collect-git-diff-stats";
import { formatFileChanges } from "../../shared/git-worktree/format-file-changes";
import { log } from "../../shared/logger";

const COOLDOWN_MS = 30_000;
const last = new Map<string, number>();

interface ChatMessageOutput {
  message: Record<string, unknown>;
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
}

export function createGitDiffInjectorHook(args: { directory: string }) {
  return {
    "chat.message": async (
      input: { sessionID: string },
      output: ChatMessageOutput,
    ): Promise<void> => {
      const now = Date.now();
      const prev = last.get(input.sessionID) ?? 0;
      if (now - prev < COOLDOWN_MS) return;

      const stats = collectGitDiffStats(args.directory);
      if (stats.length === 0) return;

      last.set(input.sessionID, now);
      const summary = formatFileChanges(stats);

      const idx = output.parts.findIndex((p) => p.type === "text" && p.text);
      if (idx === -1) return;

      output.parts[idx].text = `${summary}\n\n---\n\n${output.parts[idx].text}`;
      log("[git-diff-injector] injected git diff context", {
        sessionID: input.sessionID,
        files: stats.length,
      });
    },

    event: async ({
      event,
    }: {
      event: { type: string; properties?: unknown };
    }) => {
      if (event.type === "session.deleted") {
        const props = event.properties as
          | { info?: { id?: string } }
          | undefined;
        if (props?.info?.id) last.delete(props.info.id);
      }
    },
  };
}
