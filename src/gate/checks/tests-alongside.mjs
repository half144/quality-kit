/**
 * Arquivo novo de lógica chega com teste ao lado. Só olha as extensões de
 * lógica da config (componente se prova na tela). Arquivo que não declara
 * nenhuma função (só tipos, constantes ou dados) passa. Código extraído de
 * outro arquivo no mesmo diff (um módulo grande dividido) não conta como
 * lógica nova: o teste que cobria o código continua cobrindo.
 */

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

import { matchesAny } from '../../architecture/glob.mjs';
import { git } from '../../git/git.mjs';
import { loadDep } from '../../runtime.mjs';
import { listing } from '../run.mjs';

const NOT_LOGIC = [/\.d\.ts$/, /\.(test|spec)\./, /__tests__\//, /__mocks__\//, /\/_generated\//, /\.config\.\w+$/];
const MOVED_SHARE = 0.75;

function runtimeKinds(ts) {
  return new Set([
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.FunctionExpression,
    ts.SyntaxKind.ArrowFunction,
    ts.SyntaxKind.MethodDeclaration,
    ts.SyntaxKind.Constructor,
    ts.SyntaxKind.GetAccessor,
    ts.SyntaxKind.SetAccessor,
  ]);
}

/** Declara alguma função com corpo? Assinatura de tipo e overload não contam. */
export function hasLogic(source, fileName, ts = loadDep('typescript')) {
  const kinds = runtimeKinds(ts);
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false);
  const visit = (node) => (kinds.has(node.kind) && node.body !== undefined) || ts.forEachChild(node, visit) === true;
  return ts.forEachChild(file, visit) === true;
}

export function isLogicCandidate(path, rules) {
  return matchesAny(path, rules.areas) && rules.extensions.includes(extname(path).slice(1)) && !NOT_LOGIC.some((rule) => rule.test(path)) && !matchesAny(path, rules.ignore);
}

/**
 * Onde o teste pode morar: nas pastas de `testDirs` (`{dir}` é a pasta do
 * arquivo; o padrão é ao lado dele), com o nome do módulo. A variante de
 * plataforma (`share.web.ts`) vale com o teste dela ou com o do módulo.
 */
export function testCandidates(path, rules) {
  const name = basename(path, extname(path));
  const names = new Set([name, name.replace(/\.(web|native|ios|android)$/, '')]);
  const dirs = (rules.testDirs ?? ['{dir}']).map((dir) => dir.replace('{dir}', dirname(path)));
  return dirs.flatMap((dir) => [...names].flatMap((base) => rules.testSuffixes.map((suffix) => join(dir, base + suffix))));
}

export function removedLines(diff) {
  return new Set(
    diff
      .split('\n')
      .filter((line) => line.startsWith('-') && !line.startsWith('---'))
      .map((line) => line.slice(1).trim()),
  );
}

function significantLines(source) {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 12 && !/^import\s/.test(line) && !/\bfrom\s+['"][^'"]+['"];?$/.test(line));
}

export function isMovedCode(source, removed) {
  const lines = significantLines(source);
  return lines.length > 0 && lines.filter((line) => removed.has(line)).length / lines.length >= MOVED_SHARE;
}

export function untestedFiles(addedFiles, { rules, exists, read, removed = new Set(), ts }) {
  return addedFiles
    .filter((path) => isLogicCandidate(path, rules))
    .filter((path) => hasLogic(read(path), path, ts))
    .filter((path) => !isMovedCode(read(path), removed))
    .filter((path) => !testCandidates(path, rules).some(exists));
}

export function testsAlongsideProblem({ project, config, changes }) {
  const { repo } = project;
  const removed = removedLines(git(repo, 'diff', '-U0', '--no-color', '--no-ext-diff', changes.base));
  const untested = untestedFiles(changes.added, {
    rules: config.testsAlongside,
    exists: (path) => existsSync(join(repo, path)),
    read: (path) => readFileSync(join(repo, path), 'utf8'),
    removed,
  });
  const items = untested.map((path) => `${path}  ->  crie ${testCandidates(path, config.testsAlongside)[0]}`);
  return listing('Arquivo novo com lógica e sem teste ao lado', items);
}
