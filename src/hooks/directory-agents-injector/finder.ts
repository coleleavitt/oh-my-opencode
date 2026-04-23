import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import picomatch from "picomatch";

import { AGENTS_FILENAME } from "./constants";

export function resolveFilePath(rootDirectory: string, path: string): string | null {
  if (!path) return null;
  if (isAbsolute(path)) return path;
  return resolve(rootDirectory, path);
}

export function findAgentsMdUp(input: {
  startDir: string;
  rootDir: string;
  mdExcludes?: readonly string[];
}): string[] {
  const found: string[] = [];
  const isExcluded = input.mdExcludes?.length
    ? picomatch(input.mdExcludes as string[], { dot: true, bash: true })
    : null;
  let current = input.startDir;

  while (true) {
    // Skip root AGENTS.md - OpenCode's system.ts already loads it via custom()
    // See: https://github.com/code-yeongyu/oh-my-openagent/issues/379
    const isRootDir = current === input.rootDir;
    if (!isRootDir) {
      const agentsPath = join(current, AGENTS_FILENAME);
      if (existsSync(agentsPath)) {
        if (!isExcluded || !isExcluded(relative(input.rootDir, agentsPath))) {
          found.push(agentsPath);
        }
      }
    }

    if (isRootDir) break;
    const parent = dirname(current);
    if (parent === current) break;
    if (!parent.startsWith(input.rootDir)) break;
    current = parent;
  }

  return found.reverse();
}
