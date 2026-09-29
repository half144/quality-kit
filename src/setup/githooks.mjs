/**
 * The git hooks that call the gate. In local mode they go to `.git/hooks`,
 * which is never pushed; in team mode, to a versioned `.githooks/` (with
 * `core.hooksPath`). The hook finds the kit through `~/.quality-kit/kit`,
 * which `install` points at. The hook text follows the project's language.
 */

import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ensureDir } from '../project.mjs';
import { docText } from './doc-text.mjs';

export const MARKER = '# quality-kit';

export function hookBlock(name, language = 'en') {
  const { hook } = docText(language);
  return `${MARKER}: ${hook.comment(name)}
kit="\${QUALITY_KIT_HOME:-$HOME/.quality-kit}/kit/bin/quality-kit.mjs"
if [ -f "$kit" ]; then
  node "$kit" git-hook ${name} || exit 1
else
  echo "${hook.missing(name)}" >&2
fi
`;
}

/** The hook content: a new one, or the existing one with the kit block before the final `exit 0`. */
export function mergeHook(existing, name, language = 'en') {
  if (!existing) return `#!/bin/sh\n${hookBlock(name, language)}`;
  if (existing.includes(MARKER)) return existing;
  const lines = existing.trimEnd().split('\n');
  const tail = lines.at(-1)?.trim() === 'exit 0' ? lines.pop() : null;
  return [...lines, '', hookBlock(name, language).trimEnd(), ...(tail ? [tail] : []), ''].join('\n');
}

export function installHooks(dir, names = ['pre-commit', 'pre-push'], language = 'en') {
  ensureDir(dir);
  return names.map((name) => {
    const path = join(dir, name);
    const content = mergeHook(existsSync(path) ? readFileSync(path, 'utf8') : null, name, language);
    writeFileSync(path, content);
    chmodSync(path, 0o755);
    return path;
  });
}
