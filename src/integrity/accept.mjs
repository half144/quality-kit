/**
 * The lock's human commands: `rules accept` (accepts the current ruleset),
 * `baseline` (freezes the debt again) and `rules status`. The first two require
 * a real terminal and refuse to run inside an agent or hook.
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
import { debtGrowth } from './ruleset.mjs';
import { currentState } from './state.mjs';

const CONFIRMATION = 'accept';

/** What changed in the ruleset files since the last acceptance. Pure. */
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
  console.error(`\`quality-kit ${command}\` is for humans only, at a terminal: ${human.reason}. The agent cannot accept the ruleset.`);
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
  process.stdout.write(`Ruleset for ${project.repo} (${project.mode}, ${project.rulesDir})\n`);
  process.stdout.write(changes.length > 0 ? `Ruleset files changed since the last acceptance:\n${changes.map((line) => `  ${line}`).join('\n')}\n` : 'No ruleset file changed since the last acceptance.\n');
  if (growth.length > 0) process.stdout.write(`The frozen debt grows in ${growth.length} entries (e.g. ${growth[0].key} ${growth[0].before} -> ${growth[0].after}).\n`);
  if (!(await confirm(`Type "${CONFIRMATION}" to accept this ruleset: `))) {
    process.stdout.write('Nothing accepted.\n');
    return 1;
  }
  sealed(project, state);
  process.stdout.write('Ruleset accepted.\n');
  return 0;
}

export async function rebaseline() {
  if (refuseAgent('baseline')) return 1;
  const project = locateProject(process.cwd());
  const config = loadConfig(project.rulesDir);
  if (!(await confirm(`Freeze all of today's debt again as accepted? Type "${CONFIRMATION}": `))) return 1;
  await freezeDebt(project, config);
  sealed(project, currentState(project, config));
  process.stdout.write('Debt frozen and ruleset accepted.\n');
  return 0;
}

export function rulesStatus() {
  const project = locateProject(process.cwd());
  if (!project.mode) {
    process.stdout.write('quality-kit is not set up in this project.\n');
    return 0;
  }
  const config = loadConfig(project.rulesDir);
  const base = mergeBase(project.repo, baseRefs(config.base));
  const problems = integrityProblems(project, config, { base, ci: false });
  process.stdout.write(problems.length === 0 ? 'The ruleset is the accepted one and the debt has not grown.\n' : `${problems.join('\n\n')}\n`);
  return problems.length === 0 ? 0 : 1;
}
