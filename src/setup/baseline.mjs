/**
 * Freezes the debt that exists when the ruleset is adopted: lint violations
 * (suppressions file), strict tsc errors and architecture violations. From
 * then on it can only shrink. Runs only during setup and in
 * `quality-kit baseline`, which is a human decision.
 */

import { rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { architectureBaselinePath, suppressionsPath, tscBaselinePath } from '../config.mjs';
import { architectureCounts, measureArchitecture } from '../gate/checks/architecture.mjs';
import { lintInvocation } from '../gate/checks/lint.mjs';
import { measureTypes, tsconfigsOf } from '../gate/checks/typecheck.mjs';
import { countByFile } from '../gate/debt.mjs';
import { run } from '../gate/run.mjs';
import { ensureDir } from '../project.mjs';

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Lints the whole workspace with --suppress-all: today's debt goes into the file. */
async function freezeLint(project, config, workspace) {
  if (workspace.lint !== 'kit') return { workspace: workspace.dir, skipped: "the project's own lint: its debt stays in its own suppressions file" };
  rmSync(suppressionsPath(project, workspace), { force: true });
  const { bin, args, cwd } = lintInvocation({ project, config, workspace, files: ['.'], extra: ['--suppress-all'] });
  const { status, output } = await run(bin, args.filter((arg) => arg !== '--prune-suppressions'), { cwd });
  return { workspace: workspace.dir, status, output: status === 0 ? '' : output.slice(-4000) };
}

async function freezeTypes(project, config) {
  const all = {};
  const failures = [];
  for (const workspace of config.workspaces.filter((entry) => tsconfigsOf(entry).length > 0)) {
    const { errors, global } = await measureTypes(project, config, workspace);
    if (global.length > 0) failures.push({ workspace: workspace.dir, global });
    all[workspace.dir] = countByFile(errors);
  }
  writeJson(tscBaselinePath(project.rulesDir), all);
  return failures;
}

export async function freezeDebt(project, config) {
  const lint = [];
  for (const workspace of config.workspaces.filter((entry) => entry.lint)) lint.push(await freezeLint(project, config, workspace));
  const types = config.checks.typecheck ? await freezeTypes(project, config) : [];
  writeJson(architectureBaselinePath(project.rulesDir), architectureCounts(measureArchitecture(project, config)));
  return { lint, types };
}
