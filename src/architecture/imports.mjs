/**
 * Import direction inside a root: shared → feature → routes. With features
 * enabled, a feature does not import from another one; a sub-feature imports
 * from its own feature's root, never from a sibling; a feature's root does not
 * import from its own sub-features. `imports.forbid` in the config adds
 * path-to-path rules.
 */

import path from 'node:path';

import { featureLayout } from './app-rules.mjs';
import { matchesAny } from './glob.mjs';

const FEATURE_KINDS = ['feature', 'subfeature'];
const IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+|\b(?:vi|jest)\.mock\s*\(\s*)['"]([^'"\n]+)['"]/g;

/** Which layer a file in the root belongs to. */
export function layerOf(root, relative) {
  const parts = relative.split('/');
  if (parts.length === 1) return { kind: 'root' };
  if (root.routes && parts[0] === root.routes.dir) return { kind: 'routes' };
  if (root.features && parts[0] === root.features.dir) {
    const { feature, sub } = featureLayout(parts.slice(1), root.features.layers);
    return { kind: sub ? 'subfeature' : 'feature', feature, sub };
  }
  return { kind: 'shared' };
}

function featureToFeature(root, from, to) {
  if (to.feature !== from.feature) {
    return `feature "${from.feature}" imports from "${to.feature}": whatever both use moves up to shared code, and composition happens in the routes.`;
  }
  if (to.kind !== 'subfeature' || to.sub === from.sub) return null;
  return from.kind === 'feature'
    ? `the root of "${from.feature}" imports from sub-feature "${to.sub}": the dependency goes from the sub-feature to the root, not the other way around.`
    : `sub-feature "${from.sub}" imports from its sibling "${to.sub}": whatever both use moves up to the root of "${from.feature}".`;
}

/** Why an import between the two layers is forbidden, or null. */
export function layerViolation(root, from, to) {
  if (to.kind === 'routes' && from.kind !== 'routes') return `only ${root.routes.dir}/ may import from ${root.routes.dir}/.`;
  if (!FEATURE_KINDS.includes(to.kind)) return null;
  if (from.kind === 'shared') return 'shared code does not import from a feature: move what it needs up to shared code.';
  return FEATURE_KINDS.includes(from.kind) ? featureToFeature(root, from, to) : null;
}

function customViolation(root, fromPath, toPath) {
  const rule = (root.imports?.forbid ?? []).find((entry) => matchesAny(fromPath, [entry.from]) && matchesAny(toPath, [entry.to]));
  return rule ? rule.message : null;
}

/** The root file an import reaches, or null if it leaves the root. */
export function importTarget(root, relative, spec) {
  const alias = Object.entries(root.aliases ?? {}).find(([prefix]) => spec.startsWith(prefix));
  if (alias) return path.posix.normalize(path.posix.join(alias[1] || '.', spec.slice(alias[0].length)));
  if (!spec.startsWith('.')) return null;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(relative), spec));
  return target.startsWith('..') ? null : target;
}

export function importSpecifiers(source) {
  return [...source.matchAll(IMPORT)].map(([, spec]) => spec);
}

/** A file's import problems, as [rule, message] pairs. */
export function checkImports(root, relative, source) {
  const from = layerOf(root, relative);
  const problems = [];
  for (const spec of importSpecifiers(source)) {
    const target = importTarget(root, relative, spec);
    if (target === null) continue;
    const message = layerViolation(root, from, layerOf(root, target)) ?? customViolation(root, relative, target);
    if (message) problems.push(['import-direction', `${spec}: ${message}`]);
  }
  return problems;
}
