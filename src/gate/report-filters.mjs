/** The knip and jscpd JSON reports, narrowed to what the branch introduced. */

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

/** A duplicate export comes as a group: the names that point to the same thing. */
function itemName(item) {
  return Array.isArray(item) ? item.map((alias) => alias.name).join(' = ') : item.name;
}

const DEPENDENCY_TYPES = new Set(['dependencies', 'devDependencies', 'optionalPeerDependencies']);

/**
 * In package.json, a dependency issue only counts for what the branch added:
 * whoever declares a package does not inherit the cleanup of the others.
 */
function itemsOf(issue, type, addedDependencies) {
  const items = issue[type] ?? [];
  if (!DEPENDENCY_TYPES.has(type)) return items;
  const added = addedDependencies.get(issue.file) ?? new Set();
  return items.filter((item) => added.has(item.name));
}

/**
 * The knip issues in the given files, one line per file and type.
 * `addedDependencies` maps each package.json to the packages the branch declared.
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

/** Packages declared in `after` that `before` did not have (the base package.json and the current one). */
export function addedPackages(before, after) {
  const names = (manifest) => new Set(DEPENDENCY_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {})));
  const old = names(before);
  return new Set([...names(after)].filter((name) => !old.has(name)));
}

/** Clones the base did not have (`--baseline-from-ref`), with paths relative to the repo. */
export function newClones(report, repo) {
  const place = (file) => `${relative(repo, file.name)}:${file.start}-${file.end}`;
  return report.duplicates.filter((clone) => clone.isNew).map((clone) => `${place(clone.firstFile)} ~ ${place(clone.secondFile)}`);
}
