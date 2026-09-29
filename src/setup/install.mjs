/**
 * `quality-kit install`: uma vez por máquina. Instala as dependências do kit
 * (eslint, typescript-eslint, knip, jscpd, playwright) fora do projeto-alvo,
 * baixa o Chromium do Playwright e aponta `~/.quality-kit/kit` para esta
 * versão do plugin, que é por onde os hooks do git e o Codex acham o kit.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

import { ensureDir } from '../project.mjs';
import { depsRoot, KIT_ROOT, kitHome, runtimeDir } from '../runtime.mjs';

function step(command, args, cwd) {
  const { status } = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (status !== 0) throw new Error(`${command} ${args.join(' ')} falhou (código ${status}).`);
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
      `Dependências em ${deps}.`,
      `Kit em ${join(home, 'kit')} -> ${KIT_ROOT}.`,
      onPath ? 'O comando `quality-kit` já está no PATH.' : `Ponha ${bin} no PATH para chamar \`quality-kit\` direto (export PATH="${bin}:$PATH").`,
      '',
    ].join('\n'),
  );
  return existsSync(join(home, 'kit')) ? 0 : 1;
}
