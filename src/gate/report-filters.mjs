/** Os relatórios JSON do knip e do jscpd, recortados para o que a branch trouxe. */

import { relative } from 'node:path';

const KNIP_TYPES = [
  'files',
  'dependencies',
  'devDependencies',
  'optionalPeerDependencies',
  'unlisted',
  'binaries',
  'unresolved',
  'exports',
  'nsExports',
  'types',
  'nsTypes',
  'enumMembers',
  'namespaceMembers',
  'duplicates',
];

/** Export duplicado vem como grupo: os nomes que apontam para a mesma coisa. */
function itemName(item) {
  return Array.isArray(item) ? item.map((alias) => alias.name).join(' = ') : item.name;
}

const DEPENDENCY_TYPES = new Set(['dependencies', 'devDependencies', 'optionalPeerDependencies']);

/**
 * No package.json, a pendência de dependência só conta para o que a branch
 * acrescentou: quem declara um pacote não herda a limpeza das outras.
 */
function itemsOf(issue, type, addedDependencies) {
  const items = issue[type] ?? [];
  if (!DEPENDENCY_TYPES.has(type)) return items;
  const added = addedDependencies.get(issue.file) ?? new Set();
  return items.filter((item) => added.has(item.name));
}

/**
 * As pendências do knip nos arquivos dados, uma linha por arquivo e tipo.
 * `addedDependencies` diz, por package.json, os pacotes que a branch declarou.
 */
export function knipIssuesIn(report, files, addedDependencies = new Map()) {
  const touched = new Set(files);
  return report.issues
    .filter((issue) => touched.has(issue.file))
    .flatMap((issue) =>
      KNIP_TYPES.map((type) => [type, itemsOf(issue, type, addedDependencies)])
        .filter(([, items]) => items.length > 0)
        .map(([type, items]) => `${issue.file}: ${type} ${items.map(itemName).join(', ')}`),
    );
}

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

/** Os pacotes declarados em `after` que `before` não tinha (package.json da base e o de agora). */
export function addedPackages(before, after) {
  const names = (manifest) => new Set(DEPENDENCY_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {})));
  const old = names(before);
  return new Set([...names(after)].filter((name) => !old.has(name)));
}

/** Os clones que a base não tinha (`--baseline-from-ref`), com o caminho relativo ao repo. */
export function newClones(report, repo) {
  const place = (file) => `${relative(repo, file.name)}:${file.start}-${file.end}`;
  return report.duplicates.filter((clone) => clone.isNew).map((clone) => `${place(clone.firstFile)} ~ ${place(clone.secondFile)}`);
}
