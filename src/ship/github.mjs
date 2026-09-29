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

/** The open PR of the current branch, or null (`gh pr view` fails when there is none). */
export function openPr(repo) {
  try {
    return gh(repo, 'pr', 'view', '--json', 'url,state', '--jq', 'select(.state == "OPEN") | .url') || null;
  } catch {
    return null;
  }
}

/** Creates the PR, or rewrites the open one: shipping again after a review refreshes plan, evidence and gate. Pure. */
export function prArgs({ url, title, bodyFile, base }) {
  const fields = ['--title', title, '--body-file', bodyFile, '--base', base];
  return url ? ['pr', 'edit', url, ...fields] : ['pr', 'create', ...fields];
}

/** Returns the PR URL: the known one when editing, the one `gh pr create` prints otherwise. */
export function publishPr(repo, pr) {
  const output = gh(repo, ...prArgs(pr));
  return pr.url ?? output;
}
