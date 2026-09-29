/**
 * The gate: a single command, called by the Claude Code Stop/SubagentStop hook,
 * by the git hooks and by CI. First the integrity lock (the ruleset is the
 * accepted one and the debt has not grown); then, on the files the branch
 * touched relative to the base, the checks enabled in the ruleset. A clean
 * result is recorded by content: a turn that changed nothing does not pay again.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ALL_CHECKS, docPath, FAST_CHECKS } from '../config.mjs';
import { baseRefs, branchChanges, mergeBase } from '../git/git.mjs';
import { currentState } from '../integrity/state.mjs';
import { ensureDir } from '../project.mjs';
import { proofCheck } from '../verify/proof.mjs';
import { architectureProblem } from './checks/architecture.mjs';
import { deadCodeProblem, duplicationProblem } from './checks/dead-code.mjs';
import { lintProblem } from './checks/lint.mjs';
import { testsAlongsideProblem } from './checks/tests-alongside.mjs';
import { testsProblem } from './checks/tests.mjs';
import { typecheckProblem } from './checks/typecheck.mjs';
import { groupByWorkspace, TYPED } from './groups.mjs';
import { integrityProblems, refreshAcceptance } from './integrity-check.mjs';

export const PROFILES = { full: ALL_CHECKS, fast: FAST_CHECKS };

export function enabledChecks(config, profile) {
  return new Set(PROFILES[profile].filter((check) => config.checks[check]));
}

export function report(problems) {
  return [
    'quality-kit failed this change (the same gate as the hook, git and CI). Fix it before finishing.',
    'Refactor the code: disabling rules with comments, bulk suppressions or editing the ruleset also fail.',
    ...problems,
  ].join('\n\n');
}

async function staticProblems(context, checks) {
  const { config, changes } = context;
  const groups = groupByWorkspace(config.workspaces, changes.changed);
  const typed = groupByWorkspace(config.workspaces, changes.changed, TYPED);
  const slow = await Promise.all([
    ...(checks.has('lint') ? groups.map((group) => lintProblem(context, group)) : []),
    ...(checks.has('typecheck') ? typed.map((group) => typecheckProblem(context, group)) : []),
    ...(checks.has('tests') ? groups.map((group) => testsProblem(context, group)) : []),
    checks.has('knip') ? deadCodeProblem(context) : null,
    checks.has('jscpd') ? duplicationProblem(context) : null,
  ]);
  return [
    checks.has('architecture') ? architectureProblem({ ...context, docPath: docPath(context.project, config, 'architecture') }) : null,
    checks.has('testsAlongside') ? testsAlongsideProblem(context) : null,
    ...slow,
  ].filter(Boolean);
}

function stampPath(project, profile) {
  return join(project.stateDir, `gate-${profile}.stamp`);
}

function stampOf(changes, reguaHash) {
  return `${changes.fingerprint}:${reguaHash}`;
}

function alreadyClean(project, profile, stamp) {
  const path = stampPath(project, profile);
  return existsSync(path) && readFileSync(path, 'utf8') === stamp;
}

/**
 * Runs the gate and returns the problems (an empty list means passed).
 * `profile` is `full` (hook and CI) or `fast` (git hooks); `ci` disables the
 * cache, the local acceptance and the on-screen proof.
 */
export async function runGate({ project, config, profile = 'full', base, ci = false, allowReguaChange = false }) {
  const baseSha = mergeBase(project.repo, baseRefs(base ?? config.base));
  const options = { base: baseSha, ci, allowReguaChange };
  const integrity = integrityProblems(project, config, options);
  if (integrity.length > 0) return integrity;
  const changes = branchChanges(project.repo, baseSha);
  if (changes.changed.length === 0) return [];
  const checks = enabledChecks(config, profile);
  const stamp = stampOf(changes, currentState(project, config).reguaHash);
  const context = { project, config, changes };
  const cached = !ci && alreadyClean(project, profile, stamp);
  const problems = cached ? [] : await staticProblems(context, checks);
  if (problems.length === 0 && !cached) {
    ensureDir(project.stateDir);
    writeFileSync(stampPath(project, profile), stamp);
    refreshAcceptance(project, config, options);
  }
  const proof = checks.has('verify') && !ci ? proofCheck(project, config, changes.changed) : null;
  return [...problems, proof].filter(Boolean);
}
