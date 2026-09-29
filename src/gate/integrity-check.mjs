/** A trava de integridade aplicada a um projeto: lê o estado, compara e, se for o caso, reassina. */

import { git } from '../git/git.mjs';
import { evaluate, isSigned, machineKey, readRecord, REGUA_CHANGED, writeRecord } from '../integrity/integrity.mjs';
import { parseRenames, renamedKey } from '../integrity/regua.mjs';
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
 * Os problemas de integridade. No CI, `allowReguaChange` (um rótulo de
 * revisão humana no PR) deixa passar a régua nova; a dívida continua travada.
 */
export function integrityProblems(project, config, options) {
  const { verdict } = judge(project, config, options);
  return verdict.problems.filter((problem) => !(options.allowReguaChange && problem === REGUA_CHANGED));
}

/** Depois de um gate limpo: a dívida que encolheu vira o novo teto aceito. */
export function refreshAcceptance(project, config, options) {
  if (options.ci) return;
  const { current, verdict } = judge(project, config, options);
  if (verdict.problems.length === 0 && verdict.resign) writeRecord(project.id, current);
}
