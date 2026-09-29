/** `quality-kit map`: o mapa de telas contra as rotas do código; `--write` acrescenta as que faltam. */

import { readFileSync, writeFileSync } from 'node:fs';

import { listFiles } from '../git/git.mjs';
import { normalizeApps } from './apps.mjs';
import { mapGaps, parseFeatureMap } from './feature-map.mjs';
import { docPath } from '../config.mjs';

function missingRow(screen) {
  const dynamic = /\[/.test(screen.route);
  return `| \`${screen.file}\` | \`${screen.route}\` | ${dynamic ? 'precisa de dado de demonstração' : `\`${screen.route}\``} |  |  |`;
}

/** O mapa com as linhas que faltam no fim da tabela de cada app. Puro. */
export function withMissingRows(markdown, apps, missing) {
  const lines = markdown.split('\n');
  for (const app of apps) {
    const rows = missing.filter((screen) => screen.app === app.name).map(missingRow);
    if (rows.length === 0) continue;
    const header = lines.findIndex((line) => line.toLowerCase().startsWith(`## ${app.name.toLowerCase()}`));
    if (header === -1) {
      lines.push('', `## ${app.name} (\`${app.src}\`)`, '', '| Arquivo | Rota | Abrir em | Resumo | Feature |', '| --- | --- | --- | --- | --- |', ...rows);
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
    `Mapa: ${path}`,
    ...missing.map((screen) => `  sem linha: ${screen.app} ${screen.file} (${screen.route})${argv.includes('--write') ? ' -> acrescentada' : ''}`),
    ...stale.map((screen) => `  linha sem tela: ${screen.app} ${screen.file}`),
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  return stale.length > 0 || (missing.length > 0 && !argv.includes('--write')) ? 1 : 0;
}
