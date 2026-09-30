/**
 * A renamed branch keeps its state. Paseo creates a worktree on a placeholder
 * branch and renames it after the first message; `git branch -m` does the
 * same. The branch folder is keyed by name, so without this the plan written
 * before the rename is lost to the new name.
 *
 * The proof of a rename is git's own record: renaming a branch appends
 * "Branch: renamed refs/heads/<old> to refs/heads/<new>" to the reflog it
 * carries over, even with `core.logAllRefUpdates` off, and in worktrees of
 * bare repos. Unlike "a folder whose branch is gone", it tells a rename from a
 * deleted branch followed by a new one, so an approved plan never passes to
 * unrelated work. A former name that exists again as a live branch keeps its
 * folder.
 */

import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

import { git } from '../git/git.mjs';
import { rebaseManifest } from '../evidence/manifest.mjs';

const RENAMED = /^Branch: renamed refs\/heads\/(.+) to refs\/heads\/(.+)$/;

/** The names the branch had before, most recent first, from its reflog subjects (newest first). Pure. */
export function formerNames(reflog, branch) {
  const names = [];
  let name = branch;
  for (const line of reflog.split('\n')) {
    const match = RENAMED.exec(line.trim());
    if (match?.[2] !== name) continue;
    names.push(match[1]);
    name = match[1];
  }
  return names;
}

function reflogSubjects(repo, branch) {
  try {
    return git(repo, 'reflog', 'show', '--format=%gs', `refs/heads/${branch}`);
  } catch {
    // Detached HEAD, or a branch without a reflog: nothing says it was renamed.
    return '';
  }
}

function branchExists(repo, name) {
  try {
    git(repo, 'show-ref', '--verify', '--quiet', `refs/heads/${name}`);
    return true;
  } catch {
    return false;
  }
}

function moveFolder(from, to) {
  try {
    renameSync(from, to);
    return true;
  } catch (error) {
    // Another kit process (the guard, the Stop hook) moved it first.
    if (error.code === 'ENOENT' && existsSync(to)) return false;
    throw error;
  }
}

/**
 * The folder of `branch` under `root`. When it has none and the branch was
 * renamed from a name that has one (and no longer exists), that folder moves
 * to the new name first.
 */
export function followRename({ repo, root, branch, slug }) {
  const dir = join(root, slug(branch));
  if (existsSync(dir)) return dir;
  const former = formerNames(reflogSubjects(repo, branch), branch).find((name) => existsSync(join(root, slug(name))) && !branchExists(repo, name));
  if (!former) return dir;
  const from = join(root, slug(former));
  if (moveFolder(from, dir)) {
    rebaseManifest(dir, from);
    process.stderr.write(`quality-kit: plan moved from ${former} to ${branch} (branch renamed)\n`);
  }
  return dir;
}
