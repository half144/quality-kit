/**
 * Strict typecheck without touching tsconfig: the ruleset flags go on the `tsc`
 * command line. The whole program is checked, but only what lands in touched
 * files is enforced: an error the baseline already had is old debt; a new
 * error, or an extra one in the same file, fails.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { tscBaselinePath } from '../../config.mjs';
import { readJson } from '../../integrity/ruleset.mjs';
import { ensureDir } from '../../project.mjs';
import { projectOrKitBin } from '../bins.mjs';
import { grownItems, shrinkBaseline } from '../debt.mjs';
import { listing, run } from '../run.mjs';

const ERROR_LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const GLOBAL_ERROR = /^error (TS\d+): (.*)$/;

/** The errors from `tsc --pretty false`, with files relative to the workspace. */
export function parseTscOutput(output, cwd) {
  const errors = [];
  const global = [];
  for (const line of output.split('\n')) {
    const match = ERROR_LINE.exec(line.trim());
    if (match) {
      const [, file, row, column, code, message] = match;
      errors.push({ file: relative(cwd, resolve(cwd, file)).split('\\').join('/'), line: Number(row), column: Number(column), code, message });
    } else if (GLOBAL_ERROR.test(line.trim())) global.push(line.trim());
  }
  return { errors, global };
}

export function tsconfigsOf(workspace) {
  return [workspace.tsconfig].flat().filter(Boolean);
}

export function tscArgs(tsconfig, flags) {
  return ['-p', tsconfig, '--noEmit', '--pretty', 'false', ...flags];
}

/** Measures the whole program: used by the gate and by the setup baseline. */
export async function measureTypes(project, config, workspace) {
  const cwd = join(project.repo, workspace.dir);
  const bin = projectOrKitBin(project.repo, workspace.dir, 'tsc');
  const runs = await Promise.all(tsconfigsOf(workspace).map((tsconfig) => run(bin, tscArgs(tsconfig, config.typescript.flags), { cwd })));
  const parsed = runs.map(({ output }) => parseTscOutput(output, cwd));
  return { errors: dedupe(parsed.flatMap(({ errors }) => errors)), global: parsed.flatMap(({ global }) => global) };
}

function dedupe(errors) {
  return [...new Map(errors.map((error) => [`${error.file}:${error.line}:${error.column}:${error.code}`, error])).values()];
}

export async function typecheckProblem({ project, config }, { workspace, files }) {
  if (tsconfigsOf(workspace).length === 0) return null;
  const { errors, global } = await measureTypes(project, config, workspace);
  if (global.length > 0) return `TypeScript in ${workspace.dir || 'root'} failed to run:\n${global.join('\n')}`;
  const path = tscBaselinePath(project.rulesDir);
  const all = readJson(path, {});
  const baseline = all[workspace.dir] ?? {};
  const touched = new Set(files);
  const fresh = grownItems(errors, baseline, touched);
  if (fresh.length > 0) {
    const lines = fresh.map(({ file, line, column, code, message }) => `${workspace.dir}${file}(${line},${column}): ${code} ${message}`);
    return listing(`Strict TypeScript (${config.typescript.flags.join(' ') || 'project tsconfig'}): new errors in touched files`, lines);
  }
  const shrunk = shrinkBaseline(baseline, errors, touched);
  if (JSON.stringify(shrunk) !== JSON.stringify(baseline)) {
    ensureDir(dirname(path));
    writeFileSync(path, `${JSON.stringify({ ...all, [workspace.dir]: shrunk }, null, 2)}\n`);
  }
  return null;
}
