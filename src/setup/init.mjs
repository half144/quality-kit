/**
 * Os dois passos da skill `setup`:
 *
 * 1. `init`: lê o projeto e grava os rascunhos da régua (config,
 *    ARCHITECTURE.md, mapa de telas, complemento dos playbooks). A régua fica
 *    `pending` e o hook não cobra nada ainda; a skill revisa os rascunhos.
 * 2. `finalize`: mede e congela a dívida, confere que knip e jscpd rodam,
 *    instala os hooks do git (e, no modo time, CI, deny e AGENTS.md), liga a
 *    régua e assina o aceite. Depois disso, só `quality-kit rules accept`.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadConfig } from '../config.mjs';
import { deadCodeProblem, duplicationProblem } from '../gate/checks/dead-code.mjs';
import { git, listFiles } from '../git/git.mjs';
import { writeRecord } from '../integrity/integrity.mjs';
import { currentState } from '../integrity/state.mjs';
import { ensureDir, locateProject, rulesDirFor } from '../project.mjs';
import { freezeDebt } from './baseline.mjs';
import { buildConfig } from './config-builder.mjs';
import { detect } from './detect.mjs';
import { architectureDoc, featureMapDoc, LINT_EXTRA_TEMPLATE, playbooksDoc } from './docs.mjs';
import { installHooks } from './githooks.mjs';
import { writeTeamFiles } from './team.mjs';

export class AlreadyActiveError extends Error {
  constructor(rulesDir) {
    super(`O quality-kit já está ligado neste projeto (${rulesDir}). Mudar a régua é decisão humana: edite e rode \`quality-kit rules accept\` num terminal.`);
  }
}

function assertNotActive(project) {
  if (project.mode && loadConfig(project.rulesDir).status === 'active') throw new AlreadyActiveError(project.rulesDir);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function initProject(cwd, answers) {
  const project = locateProject(cwd);
  assertNotActive(project);
  const detection = detect(project.repo);
  const config = buildConfig(detection, answers);
  const rulesDir = ensureDir(rulesDirFor(project, answers.mode));
  writeJson(join(rulesDir, 'config.json'), config);
  writeFileSync(join(rulesDir, 'ARCHITECTURE.md'), architectureDoc(config));
  writeFileSync(join(rulesDir, 'FEATURE_MAP.md'), featureMapDoc(config, listFiles(project.repo), answers.screens ?? []));
  writeFileSync(join(rulesDir, 'PLAYBOOKS.md'), playbooksDoc(detection, config));
  if (!existsSync(join(rulesDir, 'lint-extra.cjs'))) writeFileSync(join(rulesDir, 'lint-extra.cjs'), LINT_EXTRA_TEMPLATE);
  return { rulesDir, detection, config };
}

/** knip e jscpd precisam rodar no projeto; se não rodam, saem da régua com o motivo. */
async function probeTools(project, config) {
  const changes = { base: 'HEAD', changed: [], added: [] };
  const notes = [];
  for (const [check, probe] of [['knip', deadCodeProblem], ['jscpd', duplicationProblem]]) {
    if (!config.checks?.[check]) continue;
    const problem = await probe({ project, config, changes });
    if (problem?.includes('não rodou')) {
      config.checks[check] = false;
      notes.push(`${check} desligado: não rodou neste projeto.\n${problem.split('\n').slice(1, 6).join('\n')}`);
    }
  }
  return notes;
}

function hooksDir(repo) {
  return git(repo, 'rev-parse', '--git-path', 'hooks');
}

function installGitHooks(project, mode) {
  const configured = (() => {
    try {
      return git(project.repo, 'config', '--get', 'core.hooksPath');
    } catch {
      return null;
    }
  })();
  if (mode === 'team') {
    const dir = configured && !configured.startsWith('/') ? configured : '.githooks';
    if (!configured) git(project.repo, 'config', 'core.hooksPath', dir);
    return { installed: installHooks(join(project.repo, dir)), note: configured ? null : `core.hooksPath apontado para ${dir} (cada clone precisa do mesmo: ponha \`git config core.hooksPath ${dir}\` no script de preparo).` };
  }
  const dir = join(project.repo, hooksDir(project.repo));
  const tracked = listFiles(project.repo).some((file) => join(project.repo, file).startsWith(`${dir}/`));
  if (tracked) return { installed: [], note: `core.hooksPath aponta para uma pasta versionada (${dir}): no modo local o kit não mexe nela. Chame \`quality-kit git-hook pre-push\` de lá, se quiser.` };
  return { installed: installHooks(dir), note: null };
}

function debtSummary(state) {
  const totals = {};
  for (const [key, count] of Object.entries(state.debt)) {
    const kind = key.split(':')[0];
    totals[kind] = (totals[kind] ?? 0) + count;
  }
  return totals;
}

export async function finalizeProject(cwd) {
  const project = locateProject(cwd);
  if (!project.mode) throw new Error('Rode `quality-kit init` antes (a skill `setup` faz os dois).');
  assertNotActive(project);
  const config = JSON.parse(JSON.stringify(loadConfig(project.rulesDir)));
  const notes = await probeTools(project, config);
  const debt = await freezeDebt(project, config);
  const hooks = installGitHooks(project, project.mode);
  const teamFiles = project.mode === 'team' ? writeTeamFiles(project.repo, config) : [];
  writeJson(join(project.rulesDir, 'config.json'), { ...config, status: 'active' });
  const active = loadConfig(project.rulesDir);
  const state = currentState(project, active);
  writeRecord(project.id, state);
  if (project.mode === 'team') writeJson(join(project.rulesDir, 'integrity.json'), { reguaHash: state.reguaHash });
  return { project, notes: [...notes, hooks.note].filter(Boolean), debt, debtTotals: debtSummary(state), hooks: hooks.installed, teamFiles };
}
