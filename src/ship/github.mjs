/** gh and git for `ship`, called without a shell so no output rewriter sits in between. */

import { execFileSync } from 'node:child_process';

function gh(repo, ...args) {
  return execFileSync('gh', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function githubToken(repo) {
  return gh(repo, 'auth', 'token');
}

export function repositoryId(repo) {
  return gh(repo, 'api', 'repos/{owner}/{repo}', '--jq', '.id');
}

export function pushBranch(repo) {
  execFileSync('git', ['push', '-u', 'origin', 'HEAD'], { cwd: repo, stdio: 'inherit' });
}

export function createPr(repo, { title, bodyFile, base }) {
  return gh(repo, 'pr', 'create', '--title', title, '--body-file', bodyFile, '--base', base);
}
