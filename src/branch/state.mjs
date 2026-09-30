/**
 * Delivery state per branch (the tiny plan and the evidence), outside the repo
 * and outside the ruleset hash: `~/.quality-kit/projects/<id>/branches/<branch>/`.
 * Worktrees of the same repo share it by branch name, and it follows a renamed
 * branch (`rename.mjs`).
 */

import { join } from 'node:path';

import { git } from '../git/git.mjs';
import { localRulesDir } from '../project.mjs';
import { followRename } from './rename.mjs';

export function currentBranch(repo) {
  return git(repo, 'rev-parse', '--abbrev-ref', 'HEAD');
}

export function branchSlug(branch) {
  return branch.replace(/\//g, '__').replace(/[^\w.-]/g, '-');
}

/** The one resolver of the branch folder: plan, evidence, ship and the Stop hook all go through it. */
export function branchDir(project, branch = currentBranch(project.repo)) {
  return followRename({ repo: project.repo, root: join(localRulesDir(project.id), 'branches'), branch, slug: branchSlug });
}
