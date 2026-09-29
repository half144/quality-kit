/**
 * A project's ruleset as data: the files that decide what the gate enforces
 * (config, extra lint rules, protected repo files) and the frozen debt (ESLint
 * suppressions and old tsc errors). The ruleset only changes by human
 * decision; the debt can only shrink.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { matchesAny } from '../architecture/glob.mjs';

/** Living documents and the debt itself: they are not part of the ruleset hash. */
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

/** The repo files the config protects (`integrity.protect`, globs). */
export function protectedFiles(config, repoFiles) {
  const patterns = config.integrity?.protect ?? [];
  return patterns.length === 0 ? [] : repoFiles.filter((file) => matchesAny(file, patterns));
}

/** Hash of [name, content] pairs, independent of read order. */
export function hashEntries(entries) {
  const hash = createHash('sha256');
  for (const [name, content] of [...entries].sort(([a], [b]) => a.localeCompare(b))) hash.update(name).update('\0').update(content ?? '').update('\0');
  return hash.digest('hex');
}

/** The debt in an ESLint suppressions file, as flat keys. */
export function flattenSuppressions(prefix, suppressions) {
  const flat = {};
  for (const [file, rules] of Object.entries(suppressions ?? {})) {
    for (const [rule, { count }] of Object.entries(rules)) flat[`${prefix}${file} ${rule}`] = count;
  }
  return flat;
}

/** The tsc debt (`{ file: { TS1234: n } }`), as flat keys. */
export function flattenTsc(prefix, baseline) {
  const flat = {};
  for (const [file, codes] of Object.entries(baseline ?? {})) {
    for (const [code, count] of Object.entries(codes)) flat[`${prefix}${file} ${code}`] = count;
  }
  return flat;
}

/**
 * The keys where current debt exceeds the accepted debt. `formerKey` gives the
 * key the same debt had before the file was moved: a moved file carries its own
 * debt; a new file, including one born from splitting an old one, starts clean.
 */
export function debtGrowth(accepted, current, formerKey = () => null) {
  const before = (key) => accepted[key] ?? accepted[formerKey(key)] ?? 0;
  return Object.entries(current)
    .filter(([key, count]) => count > before(key))
    .map(([key, count]) => ({ key, before: before(key), after: count }));
}

/** The debt key (`eslint:path rule`) with the path the file had in the base. */
export function renamedKey(renames) {
  return (key) => {
    const match = /^(\w+):(.*) (\S+)$/.exec(key);
    if (!match || !renames.has(match[2])) return null;
    return `${match[1]}:${renames.get(match[2])} ${match[3]}`;
  };
}

/** Renames from `git diff --name-status -M`: new path -> old path. */
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
