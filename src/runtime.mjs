/**
 * Where the kit's dependencies live (eslint, typescript-eslint, knip, jscpd,
 * playwright, cutaway). They are installed once per machine, never in the target
 * project: the plugin's own node_modules comes first (development clone), then
 * the runtime that `quality-kit install` builds in ~/.quality-kit.
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

/** One package per generation of the dependency list: a node_modules from an older kit version lacks the newest. */
const SENTINELS = ['eslint', 'cutaway'];

/** The folder whose node_modules has the dependencies, or null if nobody installed them. */
export function depsRoot({ candidates = [KIT_ROOT, runtimeDir()], exists = existsSync } = {}) {
  return candidates.find((dir) => SENTINELS.every((name) => exists(join(dir, 'node_modules', name, 'package.json')))) ?? null;
}

export class MissingDepsError extends Error {
  constructor() {
    super('The quality-kit dependencies are not installed on this machine: run `quality-kit install`.');
  }
}

function requireFromDeps() {
  const root = depsRoot();
  if (!root) throw new MissingDepsError();
  return createRequire(join(root, 'package.json'));
}

/** The absolute path of a package from the kit's dependencies. */
export function resolveDep(name) {
  return requireFromDeps().resolve(name);
}

export function loadDep(name) {
  return requireFromDeps()(name);
}

/** The executable of a package from the dependencies (node_modules/.bin). */
export function depBin(name) {
  const root = depsRoot();
  if (!root) throw new MissingDepsError();
  return join(root, 'node_modules', '.bin', name);
}
