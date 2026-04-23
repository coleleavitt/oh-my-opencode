import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import picomatch from "picomatch";

import { README_FILENAME } from "./constants";

export function resolveFilePath(rootDirectory: string, path: string): string | null {
  if (!path) return null;
  if (isAbsolute(path)) return path;
  return resolve(rootDirectory, path);
}

export function findReadmeMdUp(input: {
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
    const readmePath = join(current, README_FILENAME);
    if (existsSync(readmePath)) {
      if (!isExcluded || !isExcluded(relative(input.rootDir, readmePath))) {
        found.push(readmePath);
      }
    }

    if (current === input.rootDir) break;
    const parent = dirname(current);
    if (parent === current) break;
    if (!parent.startsWith(input.rootDir)) break;
    current = parent;
  }

  return found.reverse();
}
