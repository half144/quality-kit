/**
 * Moves the state stored under a worktree's pre-v0.3.6 project id
 * (`legacyProjectId`) to the repository's id, once, the first time the kit
 * runs there: the local ruleset with its signed acceptance, and the branch
 * folders. Nothing is overwritten: a branch folder or a ruleset the
 * repository's id already has stays, and what could not move stays where it
 * was. The acceptance signature covers the ruleset hash and the debt, not the
 * id, so it stays valid under the new name.
 */

import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';

import { rebaseManifest } from './evidence/manifest.mjs';
import { recordPath } from './integrity/integrity.mjs';
import { localRulesDir } from './project.mjs';

/** Renames unless the target exists; true when it moved. Another kit process may have moved it first. */
function moveIfAbsent(from, to) {
  if (!existsSync(from) || existsSync(to)) return false;
  try {
    renameSync(from, to);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function removeIfEmpty(dir) {
  if (existsSync(dir) && readdirSync(dir).length === 0) rmdirSync(dir);
}

function rebaseBranches(root, formerRoot) {
  const branches = join(root, 'branches');
  if (!existsSync(branches)) return;
  for (const slug of readdirSync(branches)) rebaseManifest(join(branches, slug), join(formerRoot, 'branches', slug));
}

function mergeBranches(from, to) {
  const source = join(from, 'branches');
  if (!existsSync(source)) return;
  mkdirSync(join(to, 'branches'), { recursive: true });
  for (const slug of readdirSync(source)) {
    if (moveIfAbsent(join(source, slug), join(to, 'branches', slug))) rebaseManifest(join(to, 'branches', slug), join(source, slug));
  }
  removeIfEmpty(source);
}

/** The ruleset moves whole, and only into an id that has none. */
function mergeRuleset(from, to) {
  if (!existsSync(join(from, 'config.json')) || existsSync(join(to, 'config.json'))) return false;
  for (const entry of readdirSync(from).filter((name) => name !== 'branches')) moveIfAbsent(join(from, entry), join(to, entry));
  return true;
}

export function adoptLegacyProject(legacyId, id) {
  const from = localRulesDir(legacyId);
  if (legacyId === id || !existsSync(from)) return;
  const to = localRulesDir(id);
  const hadRuleset = existsSync(join(from, 'config.json'));
  if (moveIfAbsent(from, to)) {
    rebaseBranches(to, from);
    if (hadRuleset) moveIfAbsent(recordPath(legacyId), recordPath(id));
  } else {
    if (!existsSync(from)) return;
    mergeBranches(from, to);
    if (mergeRuleset(from, to)) moveIfAbsent(recordPath(legacyId), recordPath(id));
    removeIfEmpty(from);
    // What would overwrite the repository's own state stays behind, and is retried quietly.
    if (existsSync(from)) return;
  }
  process.stderr.write(`quality-kit: state of ${legacyId} moved to ${id} (one id per repository, shared by its worktrees)\n`);
}
