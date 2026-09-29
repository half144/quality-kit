/**
 * A régua de um projeto como dado: os arquivos que decidem o que o gate cobra
 * (config, regras extras de lint, arquivos protegidos do repo) e a dívida
 * congelada (supressões do ESLint e erros antigos do tsc). A régua só muda
 * por decisão humana; a dívida só pode encolher.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { matchesAny } from '../architecture/glob.mjs';

/** Documentos vivos e a própria dívida: não entram no hash da régua. */
const NOT_REGUA = [/^ARCHITECTURE\.md$/, /^FEATURE_MAP\.md$/, /^PLAYBOOKS\.md$/, /^baseline\//, /^integrity\.json$/, /^README\.md$/, /^\.cache\//];

function walk(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [relative(base, full).split('\\').join('/')];
  });
}

export function isReguaFile(file) {
  return !NOT_REGUA.some((pattern) => pattern.test(file));
}

export function reguaFilesIn(rulesDir) {
  return walk(rulesDir).filter(isReguaFile);
}

/** Os arquivos do repo que a config protege (`integrity.protect`, globs). */
export function protectedFiles(config, repoFiles) {
  const patterns = config.integrity?.protect ?? [];
  return patterns.length === 0 ? [] : repoFiles.filter((file) => matchesAny(file, patterns));
}

/** Hash de pares [nome, conteúdo], sem depender da ordem de leitura. */
export function hashEntries(entries) {
  const hash = createHash('sha256');
  for (const [name, content] of [...entries].sort(([a], [b]) => a.localeCompare(b))) hash.update(name).update('\0').update(content ?? '').update('\0');
  return hash.digest('hex');
}

/** A dívida de um arquivo de supressões do ESLint, como chaves planas. */
export function flattenSuppressions(prefix, suppressions) {
  const flat = {};
  for (const [file, rules] of Object.entries(suppressions ?? {})) {
    for (const [rule, { count }] of Object.entries(rules)) flat[`${prefix}${file} ${rule}`] = count;
  }
  return flat;
}

/** A dívida do tsc (`{ arquivo: { TS1234: n } }`), como chaves planas. */
export function flattenTsc(prefix, baseline) {
  const flat = {};
  for (const [file, codes] of Object.entries(baseline ?? {})) {
    for (const [code, count] of Object.entries(codes)) flat[`${prefix}${file} ${code}`] = count;
  }
  return flat;
}

/**
 * As chaves em que a dívida de agora passou da aceita. `formerKey` dá a chave
 * que a mesma dívida tinha antes de o arquivo ser movido: arquivo movido leva
 * a própria dívida; arquivo novo, inclusive o que nasce de dividir um antigo,
 * entra limpo.
 */
export function debtGrowth(accepted, current, formerKey = () => null) {
  const before = (key) => accepted[key] ?? accepted[formerKey(key)] ?? 0;
  return Object.entries(current)
    .filter(([key, count]) => count > before(key))
    .map(([key, count]) => ({ key, before: before(key), after: count }));
}

/** A chave de dívida (`eslint:caminho regra`) com o caminho que o arquivo tinha na base. */
export function renamedKey(renames) {
  return (key) => {
    const match = /^(\w+):(.*) (\S+)$/.exec(key);
    if (!match || !renames.has(match[2])) return null;
    return `${match[1]}:${renames.get(match[2])} ${match[3]}`;
  };
}

/** Renomeações do `git diff --name-status -M`: caminho novo -> caminho antigo. */
export function parseRenames(nameStatus) {
  const renames = new Map();
  for (const line of nameStatus.split('\n')) {
    const [status, from, to] = line.split('\t');
    if (status?.startsWith('R') && from && to) renames.set(to, from);
  }
  return renames;
}

export function readJson(path, fallback = null) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
}
