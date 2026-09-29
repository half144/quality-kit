/**
 * Delivery state per branch (the tiny plan and the evidence), outside the repo
 * and outside the ruleset hash: `~/.quality-kit/projects/<id>/branches/<branch>/`.
 * Worktrees of the same repo share it by branch name.
 */

import { join } from 'node:path';

import { git } from '../git/git.mjs';
import { localRulesDir } from '../project.mjs';

export function currentBranch(repo) {
  return git(repo, 'rev-parse', '--abbrev-ref', 'HEAD');
}

export function branchSlug(branch) {
  return branch.replace(/\//g, '__').replace(/[^\w.-]/g, '-');
}

export function branchDir(project, branch = currentBranch(project.repo)) {
  return join(localRulesDir(project.id), 'branches', branchSlug(branch));
}
