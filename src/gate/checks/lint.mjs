/**
 * Type-aware lint with zero warnings on the touched files. In `kit` mode ESLint
 * is the kit's own, with the project config underneath and the preset on top,
 * and the frozen debt lives in the ruleset folder (`--suppressions-location`).
 * In `project` mode the project's own ESLint and config apply.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { suppressionsPath } from '../../config.mjs';
import { writeOverlay } from '../../lint/overlay.mjs';
import { ensureDir } from '../../project.mjs';
import { depBin } from '../../runtime.mjs';
import { projectOrKitBin } from '../bins.mjs';
import { run } from '../run.mjs';

/** The ESLint arguments for a workspace. Pure. */
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
  return status === 0 ? null : `ESLint in ${workspace.dir || 'root'}:\n${output.trim()}`;
}
