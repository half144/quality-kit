/** `quality-kit map`: the screen map against the routes in the code; `--write` appends the missing ones. */

import { readFileSync, writeFileSync } from 'node:fs';

import { listFiles } from '../git/git.mjs';
import { normalizeApps } from './apps.mjs';
import { mapGaps, parseFeatureMap } from './feature-map.mjs';
import { docPath } from '../config.mjs';
import { mapRow } from '../setup/docs.mjs';
import { docText } from '../setup/doc-text.mjs';
import { mapLanguage } from '../setup/language.mjs';

function missingRow(screen, needsDemoData) {
  const open = /\[/.test(screen.route) ? null : screen.route;
  return mapRow({ ...screen, open, summary: '', features: [] }, needsDemoData);
}

/** The map with the missing rows at the end of each app's table, in the map's own language. Pure. */
export function withMissingRows(markdown, apps, missing) {
  const { map } = docText(mapLanguage(markdown));
  const lines = markdown.split('\n');
  for (const app of apps) {
    const rows = missing.filter((screen) => screen.app === app.name).map((screen) => missingRow(screen, map.needsDemoData));
    if (rows.length === 0) continue;
    const header = lines.findIndex((line) => line.toLowerCase().startsWith(`## ${app.name.toLowerCase()}`));
    if (header === -1) {
      lines.push('', `## ${app.name} (\`${app.src}\`)`, '', map.header, '| --- | --- | --- | --- | --- |', ...rows);
      continue;
    }
    let end = header + 1;
    while (end < lines.length && !lines[end].startsWith('## ')) end += 1;
    while (end > header && lines[end - 1].trim() === '') end -= 1;
    lines.splice(end, 0, ...rows);
  }
  return lines.join('\n');
}

export function mapCommand({ project, config }, argv) {
  const apps = normalizeApps(config.verify);
  const path = docPath(project, config, 'map');
  const markdown = readFileSync(path, 'utf8');
  const { missing, stale } = mapGaps(apps, parseFeatureMap(markdown, apps), listFiles(project.repo));
  if (argv.includes('--write') && missing.length > 0) writeFileSync(path, withMissingRows(markdown, apps, missing));
  const lines = [
    `Map: ${path}`,
    ...missing.map((screen) => `  no row: ${screen.app} ${screen.file} (${screen.route})${argv.includes('--write') ? ' -> appended' : ''}`),
    ...stale.map((screen) => `  row with no screen: ${screen.app} ${screen.file}`),
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  return stale.length > 0 || (missing.length > 0 && !argv.includes('--write')) ? 1 : 0;
}
