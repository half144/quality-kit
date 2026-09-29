/**
 * Typecheck estrito sem mexer no tsconfig: as flags da régua entram na linha
 * de comando do `tsc`. O programa inteiro é checado, mas só cobra o que caiu
 * nos arquivos tocados: erro que a baseline já tinha é dívida antiga; erro
 * novo, ou a mais no mesmo arquivo, reprova.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { tscBaselinePath } from '../../config.mjs';
import { readJson } from '../../integrity/regua.mjs';
import { ensureDir } from '../../project.mjs';
import { projectOrKitBin } from '../bins.mjs';
import { grownItems, shrinkBaseline } from '../debt.mjs';
import { listing, run } from '../run.mjs';

const ERROR_LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const GLOBAL_ERROR = /^error (TS\d+): (.*)$/;

/** Os erros do `tsc --pretty false`, com o arquivo relativo ao workspace. */
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

/** Mede o programa inteiro: usado pelo gate e pela baseline do setup. */
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
  if (global.length > 0) return `TypeScript em ${workspace.dir || 'raiz'} não rodou:\n${global.join('\n')}`;
  const path = tscBaselinePath(project.rulesDir);
  const all = readJson(path, {});
  const baseline = all[workspace.dir] ?? {};
  const touched = new Set(files);
  const fresh = grownItems(errors, baseline, touched);
  if (fresh.length > 0) {
    const lines = fresh.map(({ file, line, column, code, message }) => `${workspace.dir}${file}(${line},${column}): ${code} ${message}`);
    return listing(`TypeScript estrito (${config.typescript.flags.join(' ') || 'tsconfig do projeto'}): erro novo nos arquivos tocados`, lines);
  }
  const shrunk = shrinkBaseline(baseline, errors, touched);
  if (JSON.stringify(shrunk) !== JSON.stringify(baseline)) {
    ensureDir(dirname(path));
    writeFileSync(path, `${JSON.stringify({ ...all, [workspace.dir]: shrunk }, null, 2)}\n`);
  }
  return null;
}
