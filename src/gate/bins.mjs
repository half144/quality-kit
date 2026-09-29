/**
 * Qual executável usar. Ferramenta que o projeto já tem instalada (vitest,
 * jest, tsc, eslint no modo `project`) vem do node_modules dele, do workspace
 * para a raiz; o resto vem das dependências do kit.
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
