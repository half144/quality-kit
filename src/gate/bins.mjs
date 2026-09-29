/**
 * Which executable to use. Tools the project already has installed (vitest,
 * jest, tsc, eslint in `project` mode) come from its own node_modules, from the
 * workspace up to the root; everything else comes from the kit's dependencies.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { depBin } from '../runtime.mjs';

export function projectBin(repo, workspaceDir, name, exists = existsSync) {
  const dirs = [...new Set([join(repo, workspaceDir), repo])];
  return dirs.map((dir) => join(dir, 'node_modules', '.bin', name)).find(exists) ?? null;
}

export function projectOrKitBin(repo, workspaceDir, name) {
  return projectBin(repo, workspaceDir, name) ?? depBin(name);
}
