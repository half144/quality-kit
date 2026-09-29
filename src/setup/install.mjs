/**
 * `quality-kit install`: once per machine. Installs the kit's dependencies
 * (eslint, typescript-eslint, knip, jscpd, playwright) outside the target
 * project, downloads Playwright's Chromium and points `~/.quality-kit/kit` at
 * this plugin version, which is how the git hooks and Codex find the kit.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

import { ensureDir } from '../project.mjs';
import { depsRoot, KIT_ROOT, kitHome, runtimeDir } from '../runtime.mjs';

function step(command, args, cwd) {
  const { status } = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (status !== 0) throw new Error(`${command} ${args.join(' ')} failed (exit code ${status}).`);
}

function relink(target, path) {
  rmSync(path, { force: true, recursive: false });
  symlinkSync(target, path);
}

function installDeps() {
  if (depsRoot()) return depsRoot();
  const dir = ensureDir(runtimeDir());
  for (const file of ['package.json', 'package-lock.json']) copyFileSync(join(KIT_ROOT, file), join(dir, file));
  step('npm', ['ci', '--no-audit', '--no-fund', '--ignore-scripts'], dir);
  return dir;
}

export function installKit() {
  const deps = installDeps();
  step(join(deps, 'node_modules', '.bin', 'playwright'), ['install', 'chromium'], deps);
  const home = ensureDir(kitHome());
  relink(KIT_ROOT, join(home, 'kit'));
  const bin = ensureDir(join(home, 'bin'));
  relink(join(KIT_ROOT, 'bin', 'quality-kit.mjs'), join(bin, 'quality-kit'));
  const onPath = (process.env.PATH ?? '').split(':').includes(bin);
  process.stdout.write(
    [
      `Dependencies in ${deps}.`,
      `Kit at ${join(home, 'kit')} -> ${KIT_ROOT}.`,
      onPath ? 'The `quality-kit` command is already on PATH.' : `Add ${bin} to PATH to call \`quality-kit\` directly (export PATH="${bin}:$PATH").`,
      '',
    ].join('\n'),
  );
  return existsSync(join(home, 'kit')) ? 0 : 1;
}
