/**
 * Onde moram as dependências do kit (eslint, typescript-eslint, knip, jscpd,
 * playwright). Elas são instaladas uma vez por máquina, nunca no projeto-alvo:
 * primeiro vale o node_modules do próprio plugin (clone de desenvolvimento),
 * depois o runtime que o `quality-kit install` monta em ~/.quality-kit.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function kitHome() {
  return process.env.QUALITY_KIT_HOME ?? join(homedir(), '.quality-kit');
}

export function kitVersion() {
  return JSON.parse(readFileSync(join(KIT_ROOT, 'package.json'), 'utf8')).version;
}

export function runtimeDir(version = kitVersion()) {
  return join(kitHome(), 'runtime', version);
}

/** A pasta cujo node_modules tem as dependências, ou null se ninguém instalou. */
export function depsRoot({ candidates = [KIT_ROOT, runtimeDir()], exists = existsSync } = {}) {
  return candidates.find((dir) => exists(join(dir, 'node_modules', 'eslint', 'package.json'))) ?? null;
}

export class MissingDepsError extends Error {
  constructor() {
    super('As dependências do quality-kit não estão instaladas nesta máquina: rode `quality-kit install`.');
  }
}

function requireFromDeps() {
  const root = depsRoot();
  if (!root) throw new MissingDepsError();
  return createRequire(join(root, 'package.json'));
}

/** O caminho absoluto de um pacote das dependências do kit. */
export function resolveDep(name) {
  return requireFromDeps().resolve(name);
}

export function loadDep(name) {
  return requireFromDeps()(name);
}

/** O executável de um pacote das dependências (node_modules/.bin). */
export function depBin(name) {
  const root = depsRoot();
  if (!root) throw new MissingDepsError();
  return join(root, 'node_modules', '.bin', name);
}
