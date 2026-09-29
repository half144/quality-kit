/**
 * `quality-kit install`: once per machine. Installs the kit's dependencies
 * (eslint, typescript-eslint, knip, jscpd, playwright, cutaway) outside the
 * target project, downloads Playwright's Chromium and cutaway's FFmpeg, and
 * points `~/.quality-kit/kit` at this plugin version, which is how the git
 * hooks and Codex find the kit.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

import { cutawayDoctor } from '../evidence/cutaway.mjs';
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

/**
 * `npm ci --ignore-scripts` skips ffmpeg-static's download; rebuilding runs it.
 * Without network it fails, and an FFmpeg on PATH still serves.
 */
function fetchFfmpeg(deps) {
  if (existsSync(join(deps, 'node_modules', 'ffmpeg-static', 'ffmpeg'))) return;
  spawnSync('npm', ['rebuild', 'ffmpeg-static', '--foreground-scripts'], { cwd: deps, stdio: 'inherit' });
}

export async function installKit() {
  const deps = installDeps();
  step(join(deps, 'node_modules', '.bin', 'playwright'), ['install', 'chromium'], deps);
  fetchFfmpeg(deps);
  const evidence = await cutawayDoctor();
  const home = ensureDir(kitHome());
  relink(KIT_ROOT, join(home, 'kit'));
  const bin = ensureDir(join(home, 'bin'));
  relink(join(KIT_ROOT, 'bin', 'quality-kit.mjs'), join(bin, 'quality-kit'));
  const onPath = (process.env.PATH ?? '').split(':').includes(bin);
  process.stdout.write(
    [
      `Dependencies in ${deps}.`,
      `Kit at ${join(home, 'kit')} -> ${KIT_ROOT}.`,
      evidence ?? 'Evidence (cutaway): ready for screenshots, framing and video.',
      onPath ? 'The `quality-kit` command is already on PATH.' : `Add ${bin} to PATH to call \`quality-kit\` directly (export PATH="${bin}:$PATH").`,
      '',
    ].join('\n'),
  );
  return existsSync(join(home, 'kit')) ? 0 : 1;
}
