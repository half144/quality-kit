/**
 * O gate: um comando só, chamado pelo hook Stop/SubagentStop do Claude Code,
 * pelos hooks do git e pelo CI. Primeiro a trava de integridade (a régua é a
 * aceita e a dívida não cresceu); depois, nos arquivos que a branch tocou em
 * relação à base, os checks ligados na régua. O resultado limpo fica gravado
 * por conteúdo: turno que não mexeu em nada não paga de novo.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ALL_CHECKS, FAST_CHECKS } from '../config.mjs';
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
    'O quality-kit reprovou a mudança (o mesmo gate do hook, do git e do CI). Corrija antes de encerrar.',
    'Refatore o código: desligar regra por comentário, suprimir em massa ou editar a régua também reprova.',
    ...problems,
  ].join('\n\n');
}

async function staticProblems(context, checks) {
  const { config, changes } = context;
  const groups = groupByWorkspace(config.workspaces, changes.changed);
  const typed = groupByWorkspace(config.workspaces, changes.changed, TYPED);
  const docPath = join(context.project.rulesDir, 'ARCHITECTURE.md');
  const slow = await Promise.all([
    ...(checks.has('lint') ? groups.map((group) => lintProblem(context, group)) : []),
    ...(checks.has('typecheck') ? typed.map((group) => typecheckProblem(context, group)) : []),
    ...(checks.has('tests') ? groups.map((group) => testsProblem(context, group)) : []),
    checks.has('knip') ? deadCodeProblem(context) : null,
    checks.has('jscpd') ? duplicationProblem(context) : null,
  ]);
  return [
    checks.has('architecture') ? architectureProblem({ ...context, docPath }) : null,
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
 * Roda o gate e devolve os problemas (lista vazia é aprovado). `profile` é
 * `full` (hook e CI) ou `fast` (hooks do git); `ci` desliga o cache, o aceite
 * local e a prova na tela.
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
