/**
 * Dead code (knip) and duplicated code (jscpd), narrowed to what the branch
 * introduced: knip scans the whole repo and only what lands in touched files
 * counts; jscpd only fails clones the base did not have.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { gitShow } from '../../git/git.mjs';
import { depBin } from '../../runtime.mjs';
import { addedPackages, knipIssuesIn, newClones } from '../report-filters.mjs';
import { listing, run } from '../run.mjs';

function branchPackages(repo, base, changed) {
  const manifests = changed.filter((file) => file.endsWith('package.json'));
  return new Map(
    manifests.map((file) => {
      const before = gitShow(repo, `${base}:${file}`);
      return [file, addedPackages(before ? JSON.parse(before) : {}, JSON.parse(readFileSync(join(repo, file), 'utf8')))];
    }),
  );
}

export function knipArgs({ production, configPath }) {
  return [...(production ? ['--production'] : []), ...(configPath ? ['--config', configPath] : []), '--reporter', 'json', '--no-exit-code', '--no-progress'];
}

function knipConfigPath(project, config) {
  return config.knip.config ? join(project.rulesDir, config.knip.config) : null;
}

export async function deadCodeProblem({ project, config, changes }) {
  const modes = config.knip.production ? [false, true] : [false];
  const configPath = knipConfigPath(project, config);
  const runs = await Promise.all(modes.map((production) => run(depBin('knip'), knipArgs({ production, configPath }), { cwd: project.repo })));
  const failed = runs.find(({ status }) => status !== 0);
  if (failed) return `knip failed to run (disable \`checks.knip\` in the ruleset if the project does not support it):\n${failed.output.slice(-3000)}`;
  const packages = branchPackages(project.repo, changes.base, changes.changed);
  const issues = new Set(runs.flatMap(({ stdout }) => knipIssuesIn(JSON.parse(stdout), changes.changed, packages)));
  return listing('Dead code in the branch files (knip; code used only by tests also counts)', [...issues]);
}

export function jscpdArgs({ base, output, config, hasProjectConfig }) {
  const tuning = hasProjectConfig ? [] : ['--min-tokens', String(config.jscpd.minTokens), '--min-lines', String(config.jscpd.minLines), '--ignore', '**/node_modules/**,**/dist/**,**/*.test.*,**/*.spec.*,**/__tests__/**,**/_generated/**'];
  const paths = hasProjectConfig ? [] : config.jscpd.paths;
  return ['--baseline-from-ref', base, '--reporters', 'json', '--output', output, '--absolute', '--silent', ...tuning, ...paths];
}

export async function duplicationProblem({ project, config, changes }) {
  const output = mkdtempSync(join(tmpdir(), 'quality-kit-jscpd-'));
  const hasProjectConfig = existsSync(join(project.repo, '.jscpd.json'));
  const { status, output: log } = await run(depBin('jscpd'), jscpdArgs({ base: changes.base, output, config, hasProjectConfig }), { cwd: project.repo });
  const reportFile = join(output, 'jscpd-report.json');
  const clones = status === 0 && existsSync(reportFile) ? newClones(JSON.parse(readFileSync(reportFile, 'utf8')), project.repo) : null;
  rmSync(output, { recursive: true, force: true });
  if (clones === null) return `jscpd failed to run:\n${log.slice(-3000)}`;
  return listing('Duplicated code the base did not have (jscpd): extract it to a single place', clones);
}
