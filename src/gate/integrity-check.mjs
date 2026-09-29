/** The integrity lock applied to a project: reads the state, compares it and re-signs when due. */

import { git } from '../git/git.mjs';
import { evaluate, isSigned, machineKey, readRecord, REGUA_CHANGED, writeRecord } from '../integrity/integrity.mjs';
import { parseRenames, renamedKey } from '../integrity/ruleset.mjs';
import { currentState, stateAt } from '../integrity/state.mjs';

function judge(project, config, { base, ci }) {
  const current = currentState(project, config);
  const record = ci ? null : readRecord(project.id);
  const recordValid = record ? isSigned(record, machineKey()) : false;
  const baseState = project.mode === 'team' ? stateAt(project, base) : null;
  const formerKey = renamedKey(parseRenames(git(project.repo, 'diff', '--name-status', '-M', base)));
  return { current, verdict: evaluate({ current, record, recordValid, baseState, formerKey, checkDebt: config.checks.suppressions }) };
}

/**
 * The integrity problems. In CI, `allowReguaChange` (a human review label on
 * the PR) lets a new ruleset through; the debt stays locked.
 */
export function integrityProblems(project, config, options) {
  const { verdict } = judge(project, config, options);
  return verdict.problems.filter((problem) => !(options.allowReguaChange && problem === REGUA_CHANGED));
}

/** After a clean gate: debt that shrank becomes the new accepted ceiling. */
export function refreshAcceptance(project, config, options) {
  if (options.ci) return;
  const { current, verdict } = judge(project, config, options);
  if (verdict.problems.length === 0 && verdict.resign) writeRecord(project.id, current);
}
