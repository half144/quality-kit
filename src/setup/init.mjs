/**
 * The two steps of the `setup` skill:
 *
 * 1. `init`: reads the project and writes the ruleset drafts (config,
 *    ARCHITECTURE.md, screen map, playbooks supplement) in the project's
 *    language. The ruleset stays `pending` and the hook enforces nothing yet;
 *    the skill reviews the drafts.
 * 2. `finalize`: measures and freezes the debt, checks that knip and jscpd
 *    run, installs the git hooks (and, in team mode, CI, deny list and
 *    AGENTS.md), turns the ruleset on and signs the acceptance. After that,
 *    only `quality-kit rules accept`.
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
import { architectureDoc, featureMapDoc, lintExtraTemplate, playbooksDoc } from './docs.mjs';
import { languageOf } from './language.mjs';
import { installHooks } from './githooks.mjs';
import { writeTeamFiles } from './team.mjs';

export class AlreadyActiveError extends Error {
  constructor(rulesDir) {
    super(`The quality-kit is already on in this project (${rulesDir}). Changing the ruleset is a human decision: edit it and run \`quality-kit rules accept\` in a terminal.`);
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
  const config = { ...buildConfig(detection, answers), language: languageOf(answers) };
  const rulesDir = ensureDir(rulesDirFor(project, answers.mode));
  writeJson(join(rulesDir, 'config.json'), config);
  writeFileSync(join(rulesDir, 'ARCHITECTURE.md'), architectureDoc(config));
  writeFileSync(join(rulesDir, 'FEATURE_MAP.md'), featureMapDoc(config, listFiles(project.repo), answers.screens ?? []));
  writeFileSync(join(rulesDir, 'PLAYBOOKS.md'), playbooksDoc(detection, config));
  if (!existsSync(join(rulesDir, 'lint-extra.cjs'))) writeFileSync(join(rulesDir, 'lint-extra.cjs'), lintExtraTemplate(config));
  return { rulesDir, detection, config };
}

/** knip and jscpd have to run in the project; if they do not, they leave the ruleset with the reason. */
async function probeTools(project, config) {
  const changes = { base: 'HEAD', changed: [], added: [] };
  const notes = [];
  for (const [check, probe] of [['knip', deadCodeProblem], ['jscpd', duplicationProblem]]) {
    if (!config.checks?.[check]) continue;
    const problem = await probe({ project, config, changes });
    if (problem?.includes('failed to run')) {
      config.checks[check] = false;
      notes.push(`${check} turned off: it failed to run in this project.\n${problem.split('\n').slice(1, 6).join('\n')}`);
    }
  }
  return notes;
}

function hooksDir(repo) {
  return git(repo, 'rev-parse', '--git-path', 'hooks');
}

/** Only the hooks the ruleset turns on (`off` is not installed). */
export function hookNames(hooks) {
  return [['pre-commit', hooks.preCommit], ['pre-push', hooks.prePush]].filter(([, profile]) => profile && profile !== 'off').map(([name]) => name);
}

function installGitHooks(project, mode, names, language) {
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
    return { installed: installHooks(join(project.repo, dir), names, language), note: configured ? null : `core.hooksPath set to ${dir} (every clone needs the same: put \`git config core.hooksPath ${dir}\` in the setup script).` };
  }
  const dir = join(project.repo, hooksDir(project.repo));
  const tracked = listFiles(project.repo).some((file) => join(project.repo, file).startsWith(`${dir}/`));
  if (tracked) return { installed: [], note: `core.hooksPath points to a versioned folder (${dir}): in local mode the kit does not touch it. Call \`quality-kit git-hook pre-push\` from there, if you want.` };
  return { installed: installHooks(dir, names, language), note: null };
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
  if (!project.mode) throw new Error('Run `quality-kit init` first (the `setup` skill does both).');
  assertNotActive(project);
  const config = JSON.parse(JSON.stringify(loadConfig(project.rulesDir)));
  const notes = await probeTools(project, config);
  const debt = await freezeDebt(project, config);
  const hooks = installGitHooks(project, project.mode, hookNames(config.hooks), languageOf(config));
  const teamFiles = project.mode === 'team' ? writeTeamFiles(project.repo, config) : [];
  writeJson(join(project.rulesDir, 'config.json'), { ...config, status: 'active' });
  const active = loadConfig(project.rulesDir);
  const state = currentState(project, active);
  writeRecord(project.acceptanceId, state);
  if (project.mode === 'team') writeJson(join(project.rulesDir, 'integrity.json'), { reguaHash: state.reguaHash });
  return { project, notes: [...notes, hooks.note].filter(Boolean), debt, debtTotals: debtSummary(state), hooks: hooks.installed, teamFiles };
}
