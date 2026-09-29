/**
 * O checker de arquitetura: a parte da estrutura que o ESLint não vê porque
 * olha um arquivo por vez. As regras vêm de `architecture` na config do
 * projeto (gerada pela skill `setup`), e cada violação diz qual regra quebrou.
 */

import path from 'node:path';

import { checkAppFile } from './app-rules.mjs';
import { checkConvexFile } from './convex-rules.mjs';
import { matchesAny } from './glob.mjs';
import { checkImports } from './imports.mjs';
import { isTest } from './names.mjs';

const DEFAULT_ALIASES = { '@/': '' };
const CHECKERS = { app: checkAppFile, convex: checkConvexFile };

export function normalizeRoot(root) {
  return { kind: 'app', aliases: DEFAULT_ALIASES, ...root, path: root.path.replace(/\/+$/, '') };
}

/** A raiz mais específica que contém o arquivo. */
export function rootOf(roots, file) {
  return roots.filter((root) => root.path === '' || file.startsWith(`${root.path}/`)).sort((a, b) => b.path.length - a.path.length)[0] ?? null;
}

function checkFile(roots, file, readFile) {
  const root = rootOf(roots, file);
  if (!root || matchesAny(file, root.ignore)) return [];
  const relative = root.path === '' ? file : file.slice(root.path.length + 1);
  const source = () => readFile(file);
  const problems = [...CHECKERS[root.kind](root, relative, source)];
  if (root.kind === 'app' && /\.[cm]?[jt]sx?$/.test(file)) problems.push(...checkImports(root, relative, source()));
  return problems.map(([rule, message]) => ({ file, rule, message }));
}

function isSizedSource(file, extensions) {
  return extensions.includes(path.posix.extname(file).slice(1)) && !isTest(file) && !/\.styles\.[jt]s$/.test(file) && !file.endsWith('.d.ts');
}

/** Pasta com código demais deixou de ter uma responsabilidade só. */
export function checkFolderSizes(files, folderSize) {
  if (!folderSize) return [];
  const { max, scopes = ['**'], exempt = [], extensions = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'] } = folderSize;
  const counts = new Map();
  for (const file of files.filter((entry) => matchesAny(entry, scopes) && isSizedSource(entry, extensions))) {
    const folder = path.posix.dirname(file);
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  return [...counts]
    .filter(([folder, count]) => count > max && !matchesAny(folder, exempt))
    .map(([folder, count]) => ({
      file: folder,
      rule: 'folder-size',
      message: `${count} arquivos de código (teto ${max}, sem contar teste e estilo): divida em subpastas por assunto.`,
    }));
}

export function checkRepository(architecture, files, readFile) {
  const roots = (architecture.roots ?? []).map(normalizeRoot);
  return [...files.flatMap((file) => checkFile(roots, file, readFile)), ...checkFolderSizes(files, architecture.folderSize)];
}

/**
 * Só as violações dos arquivos que uma mudança tocou. O tamanho de pasta é de
 * quem acrescentou arquivo nela, não de quem só editou um que já estava lá.
 */
export function violationsIn(violations, { changed, added }) {
  const touched = new Set(changed);
  const grown = new Set(added.map((file) => path.posix.dirname(file)));
  return violations.filter((violation) => (violation.rule === 'folder-size' ? grown.has(violation.file) : touched.has(violation.file)));
}

export function formatViolations(violations) {
  const lines = [];
  for (const [rule, list] of Map.groupBy(violations, (violation) => violation.rule)) {
    lines.push(`\n${rule} (${list.length})`);
    for (const violation of list) lines.push(`  ${violation.file}\n    ${violation.message}`);
  }
  return lines.join('\n');
}
