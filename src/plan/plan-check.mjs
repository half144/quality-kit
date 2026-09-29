/**
 * The plan rule of the Stop hook: a branch with code changes needs a tiny plan
 * the owner approved. Only the Claude Code hook applies it, never git or CI:
 * the plan lives on the owner's machine.
 */

import { baseRefs, branchChanges, mergeBase } from '../git/git.mjs';
import { branchDir } from '../branch/state.mjs';
import { readPlan } from './store.mjs';

const NOT_CODE = /\.(md|mdx|txt)$/i;

const MESSAGES = {
  missing: 'No tiny plan for this branch: write a tiny plan with the tiny-plan skill and get the owner\'s ok (`quality-kit plan write`, then `quality-kit plan approve` only after the owner says ok in chat).',
  draft: 'The tiny plan for this branch is not approved: show it to the owner, wait for an explicit ok in chat, then run `quality-kit plan approve`.',
  stale: 'The tiny plan changed after the owner approved it: show the new version and get a new ok before `quality-kit plan approve`.',
};

export function hasCodeChanges(changed) {
  return changed.some((file) => !NOT_CODE.test(file));
}

/** The message for a plan status, or null when approved. Pure. */
export function planProblem(status) {
  return MESSAGES[status] ?? null;
}

export function branchPlanProblem(project, config) {
  if (!config.requirePlan) return null;
  const { changed } = branchChanges(project.repo, mergeBase(project.repo, baseRefs(config.base)));
  if (!hasCodeChanges(changed)) return null;
  return planProblem(readPlan(branchDir(project)).status);
}
