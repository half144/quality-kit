/**
 * Os hooks do git que chamam o gate. No modo local vão para `.git/hooks`, que
 * não sobe; no modo time, para `.githooks/` versionado (com `core.hooksPath`).
 * O hook acha o kit por `~/.quality-kit/kit`, que o `install` aponta.
 */

import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ensureDir } from '../project.mjs';

export const MARKER = '# quality-kit';

export function hookBlock(name) {
  return `${MARKER}: o gate da régua (${name}). Sem o kit na máquina, avisa e segue; o CI cobra de qualquer jeito.
kit="\${QUALITY_KIT_HOME:-$HOME/.quality-kit}/kit/bin/quality-kit.mjs"
if [ -f "$kit" ]; then
  node "$kit" git-hook ${name} || exit 1
else
  echo "quality-kit não instalado nesta máquina: o gate do ${name} não rodou." >&2
fi
`;
}

/** O conteúdo do hook: novo, ou o existente com o bloco do kit antes do `exit 0` final. */
export function mergeHook(existing, name) {
  if (!existing) return `#!/bin/sh\n${hookBlock(name)}`;
  if (existing.includes(MARKER)) return existing;
  const lines = existing.trimEnd().split('\n');
  const tail = lines.at(-1)?.trim() === 'exit 0' ? lines.pop() : null;
  return [...lines, '', hookBlock(name).trimEnd(), ...(tail ? [tail] : []), ''].join('\n');
}

export function installHooks(dir, names = ['pre-commit', 'pre-push']) {
  ensureDir(dir);
  return names.map((name) => {
    const path = join(dir, name);
    const content = mergeHook(existsSync(path) ? readFileSync(path, 'utf8') : null, name);
    writeFileSync(path, content);
    chmodSync(path, 0o755);
    return path;
  });
}
