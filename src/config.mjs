/** The project config (`config.json` in the ruleset folder), with the kit defaults. */

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
  docs: { architecture: null, map: null },
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
    docs: { ...DEFAULTS.docs, ...config.docs },
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

/** The workspace of a repo file: the most specific one that contains it. */
export function workspaceOf(workspaces, file) {
  return workspaces.filter((workspace) => file.startsWith(workspace.dir)).sort((a, b) => b.dir.length - a.dir.length)[0] ?? null;
}

export function slug(dir) {
  return dir === '' ? 'root' : dir.replace(/\/$/, '').replace(/[/\\]/g, '__');
}

/** Where a workspace's suppressions file lives. */
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

/**
 * Where the architecture text and the screen map live: in the ruleset folder,
 * or at a repo path (`docs`) for projects that already have their own.
 */
export function docPath(project, config, name) {
  const inRepo = config.docs[name];
  return inRepo ? join(project.repo, inRepo) : join(project.rulesDir, name === 'map' ? 'FEATURE_MAP.md' : 'ARCHITECTURE.md');
}
