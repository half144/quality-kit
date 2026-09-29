/**
 * Lint com tipos e zero warning nos arquivos tocados. No modo `kit` o ESLint é
 * o do kit, com a config do projeto por baixo e o preset por cima, e a dívida
 * congelada fica na pasta da régua (`--suppressions-location`). No modo
 * `project` vale o ESLint e a config que o projeto já tem.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { suppressionsPath } from '../../config.mjs';
import { writeOverlay } from '../../lint/overlay.mjs';
import { ensureDir } from '../../project.mjs';
import { depBin } from '../../runtime.mjs';
import { projectOrKitBin } from '../bins.mjs';
import { run } from '../run.mjs';

/** Os argumentos do ESLint para um workspace. Puro. */
export function eslintArgs({ overlay, suppressions, suppressionsExist, files, extra = [] }) {
  return [
    ...(overlay ? ['--config', overlay] : []),
    ...(suppressions ? ['--suppressions-location', suppressions] : []),
    '--max-warnings',
    '0',
    '--no-warn-ignored',
    ...(suppressionsExist ? ['--prune-suppressions'] : []),
    ...extra,
    ...files,
  ];
}

export function lintInvocation({ project, config, workspace, files, extra }) {
  const kit = workspace.lint === 'kit';
  const suppressions = suppressionsPath(project, workspace);
  if (kit) ensureDir(dirname(suppressions));
  const args = eslintArgs({
    overlay: kit ? writeOverlay({ project, config, workspace }) : null,
    suppressions: kit ? suppressions : null,
    suppressionsExist: existsSync(suppressions),
    files,
    extra,
  });
  const bin = kit ? depBin('eslint') : projectOrKitBin(project.repo, workspace.dir, 'eslint');
  return { bin, args, cwd: join(project.repo, workspace.dir) };
}

export async function lintProblem(context, { workspace, files }) {
  if (!workspace.lint) return null;
  const { bin, args, cwd } = lintInvocation({ ...context, workspace, files });
  const { status, output } = await run(bin, args, { cwd });
  return status === 0 ? null : `ESLint em ${workspace.dir || 'raiz'}:\n${output.trim()}`;
}
