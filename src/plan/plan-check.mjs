/**
 * The plan rule of the Stop hook: a branch with code changes needs a tiny plan
 * the owner approved. Only the Claude Code hook applies it, never git or CI:
 * the plan lives on the owner's machine.
 *
 * A plan saved and waiting for the owner's ok, with no code changed since it
 * was saved, lets the turn end: the agent has to stop to ask. The owner gets
 * a notice, so the silence is not mistaken for finished work.
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

/** Shown to the owner (not the agent) when the turn ends waiting for the ok. */
export const AWAITING_NOTICE = 'quality-kit: waiting for your ok on the plan (quality-kit plan show)';

const TO_ASK = 'The code changed after the plan was saved: stop editing, save the plan again as it stands (`quality-kit plan write`), show it and end the turn waiting for the ok.';

export function hasCodeChanges(changed) {
  return changed.some((file) => !NOT_CODE.test(file));
}

/** The message for a plan status, or null when approved. Pure. */
export function planProblem(status) {
  return MESSAGES[status] ?? null;
}

/** The plan is saved, not approved, and no code moved since it was saved. Pure. */
export function awaitingOk(plan, fingerprint) {
  return (plan.status === 'draft' || plan.status === 'stale') && plan.written?.changes === fingerprint;
}

/** The branch's change fingerprint against the base: what `plan write` records. */
export function changesFingerprint(project, config) {
  return branchChanges(project.repo, mergeBase(project.repo, baseRefs(config.base))).fingerprint;
}

/** `awaiting`: the turn may end to ask for the ok; `problem`: why it may not end, or null. */
export function branchPlanState(project, config) {
  if (!config.requirePlan) return { awaiting: false, problem: null };
  const { changed, fingerprint } = branchChanges(project.repo, mergeBase(project.repo, baseRefs(config.base)));
  const plan = readPlan(branchDir(project));
  if (awaitingOk(plan, fingerprint)) return { awaiting: true, problem: null };
  if (!hasCodeChanges(changed)) return { awaiting: false, problem: null };
  const problem = planProblem(plan.status);
  return { awaiting: false, problem: problem && plan.status !== 'missing' ? `${problem} ${TO_ASK}` : problem };
}
