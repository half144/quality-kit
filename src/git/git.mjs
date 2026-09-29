/** git as the gate needs it: the base, what the branch changed and the fingerprint. */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function git(repo, ...args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** `git show ref:file` byte for byte (untrimmed), or null if the file did not exist at that ref. */
export function gitShow(repo, spec) {
  try {
    return execFileSync('git', ['show', spec], { cwd: repo, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return null;
  }
}

export function lines(text) {
  return text.split('\n').filter(Boolean);
}

export function repoRoot(cwd) {
  return git(cwd, 'rev-parse', '--show-toplevel');
}

/** This worktree's git folder: local state that is never pushed. */
export function gitDir(repo) {
  return resolve(repo, git(repo, 'rev-parse', '--git-dir'));
}

/** The common git folder: the same for every worktree of the repo. */
export function commonGitDir(repo) {
  return resolve(repo, git(repo, 'rev-parse', '--git-common-dir'));
}

/** The merge base with the first base ref that exists in this clone. */
export function mergeBase(repo, refs) {
  for (const ref of refs) {
    try {
      return git(repo, 'merge-base', 'HEAD', ref);
    } catch {
      // This clone lacks that ref: try the next one.
    }
  }
  throw new Error(`No base ref (${refs.join(', ')}) to compare against: run \`git fetch\`.`);
}

export function baseRefs(configured) {
  return [...new Set([configured, 'origin/main', 'main', 'origin/master', 'master'].filter(Boolean))];
}

/**
 * What the branch changed against the base, including uncommitted work.
 * `fingerprint` changes whenever any byte of the change changes.
 */
export function branchChanges(repo, base) {
  const untracked = lines(git(repo, 'ls-files', '--others', '--exclude-standard'));
  const existing = (file) => existsSync(join(repo, file));
  const hash = createHash('sha256').update(git(repo, 'diff', base));
  for (const file of untracked.filter(existing)) hash.update(file).update(readFileSync(join(repo, file)));
  return {
    base,
    changed: unique([...lines(git(repo, 'diff', '--name-only', '--diff-filter=ACMR', base)), ...untracked]).filter(existing),
    added: unique([...lines(git(repo, 'diff', '--name-only', '--diff-filter=A', base)), ...untracked]).filter(existing),
    fingerprint: hash.digest('hex'),
  };
}

/** The repository files as they are on disk: tracked and new, without deleted ones. */
export function listFiles(repo) {
  return lines(git(repo, 'ls-files', '--cached', '--others', '--exclude-standard')).filter((file) => existsSync(join(repo, file)));
}

function unique(items) {
  return [...new Set(items)];
}
