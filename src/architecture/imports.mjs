/**
 * Direção dos imports dentro de uma raiz: compartilhado → feature → rotas.
 * Com features ligadas, uma feature não importa de outra; sub-feature importa
 * da raiz da própria feature, nunca de uma irmã; a raiz da feature não importa
 * das próprias sub-features. `imports.forbid` da config soma regras de
 * caminho para caminho.
 */

import path from 'node:path';

import { featureLayout } from './app-rules.mjs';
import { matchesAny } from './glob.mjs';

const FEATURE_KINDS = ['feature', 'subfeature'];
const IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+|\b(?:vi|jest)\.mock\s*\(\s*)['"]([^'"\n]+)['"]/g;

/** A que camada um arquivo da raiz pertence. */
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
    return `feature "${from.feature}" importando de "${to.feature}": o que as duas usam sobe para o compartilhado, e a composição acontece nas rotas.`;
  }
  if (to.kind !== 'subfeature' || to.sub === from.sub) return null;
  return from.kind === 'feature'
    ? `a raiz de "${from.feature}" importando da sub-feature "${to.sub}": a dependência vai da sub-feature para a raiz, não o contrário.`
    : `sub-feature "${from.sub}" importando da irmã "${to.sub}": o que as duas usam sobe para a raiz de "${from.feature}".`;
}

/** O motivo de o import entre as duas camadas ser proibido, ou null. */
export function layerViolation(root, from, to) {
  if (to.kind === 'routes' && from.kind !== 'routes') return `só ${root.routes.dir}/ importa de ${root.routes.dir}/.`;
  if (!FEATURE_KINDS.includes(to.kind)) return null;
  if (from.kind === 'shared') return 'o compartilhado não importa de feature: suba o que ele precisa para o compartilhado.';
  return FEATURE_KINDS.includes(from.kind) ? featureToFeature(root, from, to) : null;
}

function customViolation(root, fromPath, toPath) {
  const rule = (root.imports?.forbid ?? []).find((entry) => matchesAny(fromPath, [entry.from]) && matchesAny(toPath, [entry.to]));
  return rule ? rule.message : null;
}

/** O arquivo da raiz que um import alcança, ou null se ele sai dela. */
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

/** Os problemas de import de um arquivo, como pares [regra, mensagem]. */
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
