/**
 * Código morto (knip) e duplicado (jscpd), recortados para o que a branch
 * trouxe: o knip olha o repo inteiro e só vale o que caiu nos arquivos
 * tocados; o jscpd só reprova o clone que a base não tinha.
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
  if (failed) return `O knip não rodou (desligue \`checks.knip\` na régua se o projeto não suporta):\n${failed.output.slice(-3000)}`;
  const packages = branchPackages(project.repo, changes.base, changes.changed);
  const issues = new Set(runs.flatMap(({ stdout }) => knipIssuesIn(JSON.parse(stdout), changes.changed, packages)));
  return listing('Código morto nos arquivos da branch (knip; o que só teste usa também conta)', [...issues]);
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
  if (clones === null) return `O jscpd não rodou:\n${log.slice(-3000)}`;
  return listing('Código duplicado que a base não tinha (jscpd): extraia para um lugar só', clones);
}
