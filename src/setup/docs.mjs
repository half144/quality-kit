/**
 * The documents the `setup` skill generates in the ruleset folder, in the
 * project's language: ARCHITECTURE.md (the ruleset as text, read from the
 * config), FEATURE_MAP.md (the screen map, with the routes deduced from the
 * code), PLAYBOOKS.md (the project's real commands for the playbooks) and an
 * empty lint-extra.cjs.
 */

import { normalizeApps } from '../verify/apps.mjs';
import { screenFiles } from '../verify/feature-map.mjs';
import { docText } from './doc-text.mjs';
import { languageOf } from './language.mjs';

function rootSection(root, text) {
  if (root.kind === 'convex') return text.convexRoot(root.path).join('\n');
  const lines = [`### \`${root.path}/\``, ''];
  if (root.allowedTop) lines.push(text.allowedTop(root.allowedTop));
  if (root.rootFiles) lines.push(text.rootFiles(root.rootFiles));
  if (root.naming) lines.push(text.naming(root.naming));
  if (root.noBarrel) lines.push(text.noBarrel);
  if (root.testsColocated) lines.push(text.testsColocated);
  if (root.routes) lines.push(text.routes(root.routes));
  if (root.features) lines.push(text.features(root.features), text.importDirection);
  for (const rule of root.imports?.forbid ?? []) lines.push(text.forbiddenImport(rule));
  return lines.join('\n');
}

export function architectureDoc(config) {
  const text = docText(languageOf(config));
  const { architecture } = text;
  const { roots, folderSize } = config.architecture;
  return [
    architecture.title,
    '',
    ...architecture.intro,
    '',
    architecture.where,
    '',
    ...roots.map((root) => rootSection(root, text)).flatMap((section) => [section, '']),
    architecture.limits,
    '',
    folderSize ? architecture.folderSize(folderSize.max) : architecture.noFolderSize,
    architecture.eslint,
    '',
    architecture.change,
    '',
    architecture.changeBody,
    '',
  ].join('\n');
}

function isDynamic(route) {
  return /\[|\(\.\.\.|:/.test(route);
}

/** One screen map row; `needsDemoData` fills the "open at" cell of a screen with no fixed path. */
export function mapRow({ file, route, open, summary, features }, needsDemoData) {
  const openCell = open ? `\`${open}\`` : needsDemoData;
  return `| \`${file}\` | \`${route}\` | ${openCell} | ${summary} | ${features.map((feature) => `\`${feature}\``).join(' ')} |`;
}

function appRows(app, files, extra, entryScreen) {
  const deduced = screenFiles([app], files).map((screen) => ({ ...screen, open: isDynamic(screen.route) ? null : screen.route, summary: '', features: [] }));
  const rows = [...deduced, ...extra.filter((screen) => screen.app === app.name)];
  if (rows.length > 0) return rows;
  const entry = ['App.tsx', 'App.jsx', 'main.tsx', 'main.jsx', 'index.tsx'].find((name) => files.includes(`${app.src}${name}`));
  return entry ? [{ file: entry, route: '/', open: '/', summary: entryScreen, features: [] }] : [];
}

export function featureMapDoc(config, files, extraScreens = []) {
  const { map } = docText(languageOf(config));
  const apps = normalizeApps(config.verify);
  const sections = apps.flatMap((app) => [
    `## ${app.name} (\`${app.src}\`)`,
    '',
    map.header,
    '| --- | --- | --- | --- | --- |',
    ...appRows(app, files, extraScreens, map.entryScreen).map((screen) => mapRow(screen, map.needsDemoData)),
    '',
  ]);
  return [map.title, '', map.intro, '', ...map.legend, '', ...sections].join('\n');
}

export function playbooksDoc(detection, config) {
  const { playbooks } = docText(languageOf(config));
  const run = detection.packageManager === 'npm' ? 'npm run' : detection.packageManager;
  const scripts = detection.packages.flatMap((pkg) => Object.keys(pkg.scripts).map((name) => `- \`${pkg.dir ? `${pkg.dir}: ` : ''}${run} ${name}\`: \`${pkg.scripts[name]}\``));
  return [
    playbooks.title,
    '',
    playbooks.intro,
    '',
    playbooks.gate,
    '',
    ...playbooks.gateLines,
    '',
    playbooks.scripts,
    '',
    ...(scripts.length > 0 ? scripts : [playbooks.noScripts]),
    '',
    playbooks.tests,
    '',
    ...config.workspaces.map((workspace) => `- \`${workspace.dir || '.'}\`: ${typeof workspace.test === 'string' ? workspace.test : playbooks.customTest}`),
    '',
  ].join('\n');
}

export function lintExtraTemplate(config) {
  return `${docText(languageOf(config)).lintExtra}module.exports = {
  restrictedSyntax: [],
  configs: [],
};
`;
}
