/**
 * Rules for a file inside a code root (the `src/` of an app or a package):
 * top-level folders, stray files, feature layers, the routes folder, barrels
 * and naming. Everything comes from the config; leaving an option out turns
 * the rule off.
 */

import { baseName, follows, isComponentFile, isIndex, isTest } from './names.mjs';
import { checkRouteFile } from './routes.mjs';

/**
 * Where a path under the features folder lands: the owning feature (or
 * sub-feature) and the layer. A folder inside a feature that is not a layer is
 * a sub-feature, and a sub-feature only holds layers.
 */
export function featureLayout(rest, layers) {
  const [feature, second, third] = rest;
  if (layers.includes(second)) return { feature, sub: null, unit: `${feature}`, layer: second };
  if (rest.length <= 2) return { feature, sub: null, unit: `${feature}`, layer: null };
  const layer = layers.includes(third) && rest.length > 3 ? third : null;
  return { feature, sub: second, unit: `${feature}/${second}`, layer };
}

function checkRootFile(root, fileName) {
  if (!root.rootFiles) return [];
  const tested = fileName.replace(/(\.dom)?\.(test|spec)(?=\.)/, '');
  if (root.rootFiles.includes(fileName) || (isTest(fileName) && root.rootFiles.includes(tested))) return [];
  const allowed = root.rootFiles.length > 0 ? `Only ${root.rootFiles.join(', ')} may live there.` : 'No file may live loose there.';
  return [['root-files', `stray file at the root of ${root.path}/. ${allowed}`]];
}

function namingProblems(root, parts) {
  const { naming } = root;
  if (!naming) return [];
  const problems = [];
  for (const folder of parts.slice(0, -1)) {
    if (folder !== '__tests__' && !folder.startsWith('.') && !follows(naming.folders, folder)) {
      problems.push(['naming', `folder "${folder}" does not follow ${naming.folders}.`]);
    }
  }
  const fileName = parts.at(-1);
  const convention = isComponentFile(fileName) ? (naming.components ?? naming.files) : naming.files;
  const exempt = fileName.startsWith('.') || isTest(fileName) || (parts.length === 1 && root.rootFiles?.includes(fileName));
  if (!exempt && !follows(convention, baseName(fileName))) {
    problems.push(['naming', `file "${fileName}" does not follow ${convention}.`]);
  }
  return problems;
}

function featureProblems(root, parts) {
  const { features } = root;
  if (!features || parts[0] !== features.dir) return [];
  const layout = featureLayout(parts.slice(1), features.layers);
  if (layout.layer) return [];
  return [['feature-folders', `stray file in ${features.dir}/${layout.unit}: move it into one of the folders ${features.layers.join(', ')}.`]];
}

function nonRouteProblems(root, relative, parts) {
  return [
    ...(root.noBarrel && isIndex(relative) ? [['no-barrel', 're-exporting index files are not allowed: import straight from the file.']] : []),
    ...namingProblems(root, parts),
    ...featureProblems(root, parts),
  ];
}

/**
 * A file's problems, as [rule, message] pairs. `relative` is the path below
 * the root; `source()` reads the file when a rule needs it.
 */
export function checkAppFile(root, relative, source) {
  const parts = relative.split('/');
  if (parts.length === 1) return [...checkRootFile(root, relative), ...namingProblems(root, parts)];
  const [top, ...rest] = parts;
  if (root.allowedTop && !root.allowedTop.includes(top)) {
    return [['top-folders', `folder "${top}" is not part of the layout. The top of ${root.path}/ only has: ${root.allowedTop.join(', ')}.`]];
  }
  const colocated = root.testsColocated && parts.includes('__tests__') ? [['tests-colocated', 'tests live next to the file under test (x.ts + x.test.ts), not in __tests__.']] : [];
  if (root.routes && top === root.routes.dir) return [...colocated, ...checkRouteFile(root.routes.framework, rest, source)];
  return [...colocated, ...nonRouteProblems(root, relative, parts)];
}
