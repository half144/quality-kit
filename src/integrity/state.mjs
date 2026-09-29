/** A project's ruleset state, read from disk or from a git ref. */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { architectureBaselinePath, suppressionsPath, tscBaselinePath, withDefaults } from '../config.mjs';
import { git, gitShow, lines, listFiles } from '../git/git.mjs';
import { flattenSuppressions, flattenTsc, hashEntries, isReguaFile, protectedFiles, readJson, reguaFilesIn } from './ruleset.mjs';

function debtOf(config, readSuppressions, tsc, architecture) {
  const debt = {};
  for (const workspace of config.workspaces.filter((entry) => entry.lint)) {
    Object.assign(debt, flattenSuppressions(`eslint:${workspace.dir}`, readSuppressions(workspace)));
  }
  for (const [dir, files] of Object.entries(tsc ?? {})) Object.assign(debt, flattenTsc(`tsc:${dir}`, files));
  Object.assign(debt, flattenTsc('arch:', architecture ?? {}));
  return debt;
}

/** The current state: ruleset hash and frozen debt. */
export function currentState(project, config) {
  const { repo, rulesDir } = project;
  const rulesEntries = reguaFilesIn(rulesDir).map((file) => [`rules/${file}`, readFileSync(join(rulesDir, file), 'utf8')]);
  const repoEntries = protectedFiles(config, listFiles(repo)).map((file) => [`repo/${file}`, readFileSync(join(repo, file), 'utf8')]);
  const readSuppressions = (workspace) => readJson(suppressionsPath(project, workspace), {});
  const entries = [...rulesEntries, ...repoEntries];
  return { reguaHash: hashEntries(entries), files: fileHashes(entries), debt: debtOf(config, readSuppressions, readJson(tscBaselinePath(rulesDir), {}), readJson(architectureBaselinePath(rulesDir), {})) };
}

/** The hash of each ruleset file: only to show the human what changed. */
export function fileHashes(entries) {
  return Object.fromEntries(entries.map(([name, content]) => [name, hashEntries([[name, content]]).slice(0, 12)]));
}

function jsonAt(repo, ref, path, fallback) {
  const text = gitShow(repo, `${ref}:${path}`);
  return text === null ? fallback : JSON.parse(text);
}

/**
 * The state at the base ref, for team mode: the ruleset that already went
 * through merge review. Null if the base did not have the kit yet.
 */
export function stateAt(project, ref) {
  const { repo, rulesDir } = project;
  const rulesPrefix = relative(repo, rulesDir);
  const config = jsonAt(repo, ref, `${rulesPrefix}/config.json`, null);
  if (!config) return null;
  const full = withDefaults(config);
  const rulesFiles = lines(git(repo, 'ls-tree', '-r', '--name-only', ref, '--', rulesPrefix)).map((file) => file.slice(rulesPrefix.length + 1));
  const reguaFiles = rulesFiles.filter(isReguaFile);
  const rulesEntries = reguaFiles.map((file) => [`rules/${file}`, gitShow(repo, `${ref}:${rulesPrefix}/${file}`)]);
  const repoFiles = lines(git(repo, 'ls-tree', '-r', '--name-only', ref));
  const repoEntries = protectedFiles(full, repoFiles).map((file) => [`repo/${file}`, gitShow(repo, `${ref}:${file}`)]);
  const readSuppressions = (workspace) => jsonAt(repo, ref, relative(repo, suppressionsPath(project, workspace)), {});
  const tsc = jsonAt(repo, ref, relative(repo, tscBaselinePath(rulesDir)), {});
  const architecture = jsonAt(repo, ref, relative(repo, architectureBaselinePath(rulesDir)), {});
  return { reguaHash: hashEntries([...rulesEntries, ...repoEntries]), debt: debtOf(full, readSuppressions, tsc, architecture) };
}
