/**
 * Os comandos humanos da trava: `rules accept` (aceita a régua de agora),
 * `baseline` (congela a dívida de novo) e `rules status`. Os dois primeiros
 * exigem um terminal de verdade e recusam rodar dentro de agente ou hook.
 */

import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

import { loadConfig } from '../config.mjs';
import { integrityProblems } from '../gate/integrity-check.mjs';
import { baseRefs, mergeBase } from '../git/git.mjs';
import { locateProject } from '../project.mjs';
import { freezeDebt } from '../setup/baseline.mjs';
import { humanAtTerminal, readRecord, writeRecord } from './integrity.mjs';
import { debtGrowth } from './regua.mjs';
import { currentState } from './state.mjs';

const CONFIRMATION = 'aceito';

/** O que mudou nos arquivos da régua desde o último aceite. Puro. */
export function reguaDiff(before = {}, after = {}) {
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return names
    .filter((name) => before[name] !== after[name])
    .map((name) => {
      if (!(name in before)) return `+ ${name}`;
      return name in after ? `~ ${name}` : `- ${name}`;
    });
}

function refuseAgent(command) {
  const human = humanAtTerminal();
  if (human.ok) return false;
  console.error(`\`quality-kit ${command}\` é só para humano, num terminal: ${human.reason}. O agente não pode aceitar a régua.`);
  return true;
}

async function confirm(question) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(question);
  prompt.close();
  return answer.trim().toLowerCase() === CONFIRMATION;
}

function sealed(project, state) {
  writeRecord(project.id, state);
  if (project.mode === 'team') writeFileSync(join(project.rulesDir, 'integrity.json'), `${JSON.stringify({ reguaHash: state.reguaHash }, null, 2)}\n`);
  for (const profile of ['full', 'fast']) rmSync(join(project.stateDir, `gate-${profile}.stamp`), { force: true });
}

export async function acceptRules() {
  if (refuseAgent('rules accept')) return 1;
  const project = locateProject(process.cwd());
  const config = loadConfig(project.rulesDir);
  const state = currentState(project, config);
  const record = readRecord(project.id);
  const changes = reguaDiff(record?.files, state.files);
  const growth = debtGrowth(record?.debt ?? {}, state.debt);
  process.stdout.write(`Régua de ${project.repo} (${project.mode}, ${project.rulesDir})\n`);
  process.stdout.write(changes.length > 0 ? `Arquivos da régua que mudaram desde o último aceite:\n${changes.map((line) => `  ${line}`).join('\n')}\n` : 'Nenhum arquivo da régua mudou desde o último aceite.\n');
  if (growth.length > 0) process.stdout.write(`A dívida congelada cresce em ${growth.length} entradas (ex.: ${growth[0].key} ${growth[0].before} -> ${growth[0].after}).\n`);
  if (!(await confirm(`Digite "${CONFIRMATION}" para aceitar esta régua: `))) {
    process.stdout.write('Nada aceito.\n');
    return 1;
  }
  sealed(project, state);
  process.stdout.write('Régua aceita.\n');
  return 0;
}

export async function rebaseline() {
  if (refuseAgent('baseline')) return 1;
  const project = locateProject(process.cwd());
  const config = loadConfig(project.rulesDir);
  if (!(await confirm(`Congelar de novo toda a dívida de hoje como aceita? Digite "${CONFIRMATION}": `))) return 1;
  await freezeDebt(project, config);
  sealed(project, currentState(project, config));
  process.stdout.write('Dívida congelada e régua aceita.\n');
  return 0;
}

export function rulesStatus() {
  const project = locateProject(process.cwd());
  if (!project.mode) {
    process.stdout.write('O quality-kit não está montado neste projeto.\n');
    return 0;
  }
  const config = loadConfig(project.rulesDir);
  const base = mergeBase(project.repo, baseRefs(config.base));
  const problems = integrityProblems(project, config, { base, ci: false });
  process.stdout.write(problems.length === 0 ? 'A régua é a aceita e a dívida não cresceu.\n' : `${problems.join('\n\n')}\n`);
  return problems.length === 0 ? 0 : 1;
}
