/**
 * The evidence of a branch: `evidence/manifest.json` in the branch folder. Each
 * item records the tree it was captured on (the same fingerprint verify uses);
 * once a file changes, the item is stale and the PR cannot show it.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readJson } from '../integrity/ruleset.mjs';
import { ensureDir } from '../project.mjs';

export function evidenceDir(branch) {
  return join(branch, 'evidence');
}

function manifestPath(branch) {
  return join(evidenceDir(branch), 'manifest.json');
}

export function readManifest(branch) {
  return readJson(manifestPath(branch), { items: [] });
}

export function writeManifest(branch, manifest) {
  ensureDir(evidenceDir(branch));
  writeFileSync(manifestPath(branch), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Items captured under `from` point under `to`: the branch folder moved (renamed branch, new project id). Pure. */
export function rebaseItems(items, from, to) {
  const moved = (path) => (path?.startsWith(`${from}/`) ? join(to, path.slice(from.length + 1)) : path);
  return items.map((item) => ({ ...item, file: moved(item.file), framed: moved(item.framed) }));
}

/** The manifest of a branch folder that was moved from `from`, rewritten to its new place. */
export function rebaseManifest(branch, from) {
  const manifest = readManifest(branch);
  if (manifest.items.length === 0) return;
  writeManifest(branch, { ...manifest, items: rebaseItems(manifest.items, from, branch) });
}

function itemKey({ kind, screen, device, caption }) {
  return [kind, screen, device, caption ?? ''].join(' ');
}

/** A new capture of the same screen, device and caption replaces the old one. */
export function withItems(manifest, items) {
  const replaced = new Set(items.map(itemKey));
  return { items: [...manifest.items.filter((item) => !replaced.has(itemKey(item))), ...items] };
}

export function byFreshness(items, tree) {
  return { fresh: items.filter((item) => item.tree === tree), stale: items.filter((item) => item.tree !== tree) };
}

/** Why the evidence cannot go into the PR, or null. `screens` are the changed screens (screen map). Pure. */
export function evidenceGap({ screens, fresh, stale }) {
  if (stale.length > 0) {
    const listed = stale.map((item) => `${item.screen} (${item.kind}, ${item.device})`).join(', ');
    return `Evidence captured before the last change: ${listed}. Capture it again (\`quality-kit evidence still\` / \`record\`) or start over with \`quality-kit evidence clear\`.`;
  }
  if (screens.length > 0 && fresh.length === 0) {
    return `This branch changes screens (${screens.join(', ')}) and has no evidence for the current files: run \`quality-kit evidence still <path>\` (and \`evidence record\` for an interaction).`;
  }
  return null;
}
