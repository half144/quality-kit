/**
 * Lê o projeto para a skill `setup`: gerenciador de pacotes, monorepo, a
 * stack de cada pacote (Next, Expo, Vite/React, Node, Convex), testes,
 * TypeScript, lint, e a forma atual do código (pastas do topo, convenção de
 * nomes, barris, `__tests__`). Só leitura.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { baseName, isCode, isComponentFile, isIndex, isTest } from '../architecture/names.mjs';
import { git, listFiles } from '../git/git.mjs';

const LOCKFILES = [
  ['package-lock.json', 'npm'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
];

function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

export function packageManager(exists) {
  return LOCKFILES.find(([file]) => exists(file))?.[1] ?? 'npm';
}

/** Os padrões de workspace do package.json ou do pnpm-workspace.yaml. */
export function workspacePatterns(rootPackage, pnpmWorkspace) {
  const fromPackage = Array.isArray(rootPackage?.workspaces) ? rootPackage.workspaces : (rootPackage?.workspaces?.packages ?? []);
  const fromPnpm = [...(pnpmWorkspace ?? '').matchAll(/^\s*-\s*['"]?([^'"\n]+)['"]?\s*$/gm)].map(([, pattern]) => pattern);
  return [...fromPackage, ...fromPnpm];
}

function expandPattern(repo, pattern) {
  if (!pattern.endsWith('/*')) return existsSync(join(repo, pattern, 'package.json')) ? [pattern] : [];
  const parent = pattern.slice(0, -2);
  if (!existsSync(join(repo, parent))) return [];
  return readdirSync(join(repo, parent))
    .map((name) => `${parent}/${name}`)
    .filter((dir) => statSync(join(repo, dir)).isDirectory() && existsSync(join(repo, dir, 'package.json')));
}

export function stackOf(pkg, has) {
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const scripts = Object.values(pkg?.scripts ?? {}).join(' ');
  return {
    next: 'next' in deps,
    expo: 'expo' in deps,
    expoRouter: 'expo-router' in deps,
    vite: 'vite' in deps,
    react: 'react' in deps,
    reactRouter: 'react-router' in deps || 'react-router-dom' in deps,
    convex: 'convex' in deps || has('convex'),
    tauri: '@tauri-apps/api' in deps,
    test: 'vitest' in deps ? 'vitest' : 'jest' in deps || 'jest-expo' in deps ? 'jest' : /node --test/.test(scripts) ? 'node' : 'none',
  };
}

const CONFIG_FILES = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts'];
const LEGACY_FILES = ['.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml'];

function tsconfigsOf(dir, has) {
  if (!has(join(dir, 'tsconfig.json'))) return [];
  const tsconfig = readFileSync(join(dir, 'tsconfig.json'), 'utf8');
  const references = [...tsconfig.matchAll(/"path"\s*:\s*"([^"]+)"/g)].map(([, path]) => path.replace(/^\.\//, ''));
  const solutionStyle = /"files"\s*:\s*\[\s*\]/.test(tsconfig) && references.length > 0;
  const referenced = references.map((path) => (path.endsWith('.json') ? path : `${path}/tsconfig.json`));
  return solutionStyle ? referenced : ['tsconfig.json', ...referenced];
}

function srcDirOf(dir, has) {
  return ['src', 'app', 'lib'].map((name) => (dir ? `${dir}/${name}` : name)).find((path) => has(path)) ?? null;
}

function routesOf(src, stack, has) {
  if (!src) return null;
  const candidates = [`${src}/app`, src.replace(/\/?src$/, '') ? `${src.replace(/\/src$/, '')}/app` : 'app'];
  const dir = candidates.find((path) => has(path));
  if (!dir) return null;
  if (stack.next) return { dir, framework: 'next' };
  if (stack.expoRouter) return { dir, framework: 'expo-router' };
  return null;
}

/** Abaixo disso o código não tem uma convenção: a régua "manter" não inventa uma. */
const CONSISTENT = 0.8;

function convention(names) {
  const tally = { kebab: 0, camel: 0, pascal: 0 };
  for (const name of names) {
    if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(name)) tally.kebab += 1;
    else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) tally.pascal += 1;
    else if (/^[a-z][a-zA-Z0-9]*$/.test(name)) tally.camel += /[A-Z]/.test(name) ? 1 : 0;
  }
  const total = tally.kebab + tally.camel + tally.pascal;
  const [best, count] = Object.entries(tally).sort(([, a], [, b]) => b - a)[0];
  if (total === 0) return 'kebab';
  return count / total >= CONSISTENT ? best : 'any';
}

/** A forma atual do código de uma raiz: o que a régua "manter o que existe" congela. */
export function shapeOf(files, src) {
  const inside = files.filter((file) => file.startsWith(`${src}/`)).map((file) => file.slice(src.length + 1));
  const code = inside.filter((file) => isCode(file) && !isTest(file));
  const counts = Map.groupBy(code, (file) => file.split('/').slice(0, -1).join('/'));
  return {
    topFolders: [...new Set(inside.filter((file) => file.includes('/')).map((file) => file.split('/')[0]))].sort(),
    rootFiles: inside.filter((file) => !file.includes('/')).sort(),
    naming: {
      files: convention(code.filter((file) => !isComponentFile(file)).map((file) => baseName(file))),
      components: convention(code.filter(isComponentFile).map((file) => baseName(file))),
      folders: convention([...new Set(inside.flatMap((file) => file.split('/').slice(0, -1)))].filter((name) => name !== '__tests__')),
    },
    barrels: code.filter((file) => isIndex(file)).length,
    testsInFolder: inside.filter((file) => file.includes('__tests__/')).length,
    largestFolder: Math.max(0, ...[...counts.values()].map((list) => list.length)),
    hasFeatures: inside.some((file) => file.startsWith('features/')),
  };
}

function describePackage(repo, dir, files) {
  const has = (path) => existsSync(join(repo, path));
  const pkg = readJson(join(repo, dir, 'package.json'));
  const stack = stackOf(pkg, (name) => has(join(dir, name)));
  const src = srcDirOf(dir, has);
  return {
    dir,
    name: pkg?.name ?? (dir || 'root'),
    stack,
    scripts: pkg?.scripts ?? {},
    tsconfigs: tsconfigsOf(join(repo, dir), (path) => existsSync(path)),
    eslint: CONFIG_FILES.find((file) => has(join(dir, file))) ?? (LEGACY_FILES.find((file) => has(join(dir, file))) ? 'legacy' : null),
    src,
    routes: routesOf(src, stack, has),
    convexDir: stack.convex ? ['convex', 'src/convex'].map((name) => (dir ? `${dir}/${name}` : name)).find(has) ?? null : null,
    shape: src ? shapeOf(files, src) : null,
  };
}

function defaultBase(repo) {
  try {
    return git(repo, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD');
  } catch {
    return 'origin/main';
  }
}

export function detect(repo) {
  const has = (path) => existsSync(join(repo, path));
  const rootPackage = readJson(join(repo, 'package.json'));
  const pnpm = has('pnpm-workspace.yaml') ? readFileSync(join(repo, 'pnpm-workspace.yaml'), 'utf8') : null;
  const packageDirs = workspacePatterns(rootPackage, pnpm).flatMap((pattern) => expandPattern(repo, pattern));
  const files = listFiles(repo);
  let hooksPath = null;
  try {
    hooksPath = git(repo, 'config', '--get', 'core.hooksPath');
  } catch {
    hooksPath = null;
  }
  return {
    repo,
    packageManager: packageManager(has),
    monorepo: packageDirs.length > 0,
    base: defaultBase(repo),
    packages: ['', ...packageDirs].map((dir) => describePackage(repo, dir, files)),
    existing: {
      knip: ['knip.json', 'knip.jsonc', '.knip.json'].find(has) ?? null,
      jscpd: has('.jscpd.json'),
      githooks: has('.githooks'),
      hooksPath,
      workflows: has('.github/workflows'),
      agentsMd: has('AGENTS.md'),
      claudeMd: has('CLAUDE.md'),
    },
  };
}
