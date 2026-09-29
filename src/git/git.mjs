/** O git como o gate precisa dele: a base, o que a branch mudou e a impressão digital. */

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

/** `git show ref:arquivo` byte a byte (sem aparar), ou null se o arquivo não existia naquela ref. */
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

/** A pasta do git desta worktree: estado local que nunca sobe. */
export function gitDir(repo) {
  return resolve(repo, git(repo, 'rev-parse', '--git-dir'));
}

/** A pasta comum do git: a mesma para todas as worktrees do repo. */
export function commonGitDir(repo) {
  return resolve(repo, git(repo, 'rev-parse', '--git-common-dir'));
}

/** O merge-base com a primeira ref de base que existir neste clone. */
export function mergeBase(repo, refs) {
  for (const ref of refs) {
    try {
      return git(repo, 'merge-base', 'HEAD', ref);
    } catch {
      // Sem essa ref neste clone: tenta a próxima.
    }
  }
  throw new Error(`Sem nenhuma ref de base (${refs.join(', ')}) para comparar: rode \`git fetch\`.`);
}

export function baseRefs(configured) {
  return [...new Set([configured, 'origin/main', 'main', 'origin/master', 'master'].filter(Boolean))];
}

/**
 * O que a branch mudou contra a base, inclusive o que não foi commitado.
 * `fingerprint` muda quando qualquer byte da mudança muda.
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

/** Os arquivos do repositório como estão no disco: versionados e novos, sem os apagados. */
export function listFiles(repo) {
  return lines(git(repo, 'ls-files', '--cached', '--others', '--exclude-standard')).filter((file) => existsSync(join(repo, file)));
}

function unique(items) {
  return [...new Set(items)];
}
