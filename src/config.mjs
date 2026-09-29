/** A config do projeto (`config.json` na pasta da régua), com os padrões do kit. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_TS_FLAGS = ['--strict', '--noUncheckedIndexedAccess', '--noImplicitOverride', '--noFallthroughCasesInSwitch', '--noImplicitReturns'];

export const ALL_CHECKS = ['architecture', 'lint', 'typecheck', 'tests', 'testsAlongside', 'suppressions', 'knip', 'jscpd', 'verify'];
export const FAST_CHECKS = ['architecture', 'testsAlongside', 'suppressions'];

const DEFAULTS = {
  version: 1,
  status: 'active',
  base: 'origin/main',
  workspaces: [{ dir: '', tsconfig: 'tsconfig.json', test: 'none', lint: 'kit' }],
  typescript: { flags: DEFAULT_TS_FLAGS },
  architecture: { roots: [], folderSize: null },
  testsAlongside: {
    areas: ['src/**'],
    extensions: ['ts', 'mts', 'mjs', 'js'],
    testSuffixes: ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.dom.test.ts', '.test.mjs', '.test.js'],
    ignore: [],
  },
  checks: Object.fromEntries(ALL_CHECKS.map((check) => [check, true])),
  hooks: { preCommit: 'fast', prePush: 'fast' },
  lint: { extraRules: 'lint-extra.cjs' },
  knip: { config: null },
  jscpd: { paths: ['src'], minTokens: 50, minLines: 5 },
  verify: { apps: [] },
  integrity: { protect: [] },
};

export function withDefaults(config) {
  return {
    ...DEFAULTS,
    ...config,
    typescript: { ...DEFAULTS.typescript, ...config.typescript },
    testsAlongside: { ...DEFAULTS.testsAlongside, ...config.testsAlongside },
    checks: { ...DEFAULTS.checks, ...config.checks },
    hooks: { ...DEFAULTS.hooks, ...config.hooks },
    lint: { ...DEFAULTS.lint, ...config.lint },
    jscpd: { ...DEFAULTS.jscpd, ...config.jscpd },
    integrity: { ...DEFAULTS.integrity, ...config.integrity },
    workspaces: (config.workspaces ?? DEFAULTS.workspaces).map(normalizeWorkspace),
  };
}

export function normalizeWorkspace(workspace) {
  const dir = workspace.dir === '' || workspace.dir.endsWith('/') ? workspace.dir : `${workspace.dir}/`;
  return { tsconfig: 'tsconfig.json', test: 'none', lint: 'kit', ...workspace, dir: dir === './' ? '' : dir };
}

export function loadConfig(rulesDir) {
  return withDefaults(JSON.parse(readFileSync(join(rulesDir, 'config.json'), 'utf8')));
}

/** O workspace de um arquivo do repo: o mais específico que o contém. */
export function workspaceOf(workspaces, file) {
  return workspaces.filter((workspace) => file.startsWith(workspace.dir)).sort((a, b) => b.dir.length - a.dir.length)[0] ?? null;
}

export function slug(dir) {
  return dir === '' ? 'root' : dir.replace(/\/$/, '').replace(/[/\\]/g, '__');
}

/** Onde mora o arquivo de supressões de um workspace. */
export function suppressionsPath({ repo, rulesDir }, workspace) {
  if (workspace.lint === 'project') return join(repo, workspace.dir, 'eslint-suppressions.json');
  return join(rulesDir, 'baseline', 'eslint', `${slug(workspace.dir)}.json`);
}

export function tscBaselinePath(rulesDir) {
  return join(rulesDir, 'baseline', 'tsc.json');
}

export function architectureBaselinePath(rulesDir) {
  return join(rulesDir, 'baseline', 'architecture.json');
}
