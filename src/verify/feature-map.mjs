/**
 * O mapa de telas (`FEATURE_MAP.md` na pasta da régua) lido como dado: uma
 * linha por tela, com o caminho que o verify abre e as features que a
 * alimentam. Nos apps com roteamento por arquivo (Next, Expo Router) também
 * deduz as rotas que existem, para cobrar o mapa que ficou para trás.
 */

import { screenRoot } from './apps.mjs';

const NEXT_SCREEN = /(^|\/)page\.[jt]sx?$/;
const EXPO_NOT_SCREEN = /(^|\/)(_layout|\+html|\+not-found|\+native-intent)(\.[a-z]+)?\.[jt]sx?$/;

function cells(line) {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function ticked(cell) {
  return [...cell.matchAll(/`([^`]+)`/g)].map(([, value]) => value);
}

function screenFromRow(app, row) {
  const [file = '', route = '', open = '', summary = '', features = ''] = cells(row);
  const [openPath] = ticked(open).filter((value) => value.startsWith('/'));
  return { app, file: ticked(file)[0] ?? file, route: ticked(route)[0] ?? route, open: openPath ?? null, reason: openPath ? null : open, summary, features: ticked(features) };
}

function isDataRow(line) {
  return line.startsWith('|') && !/^\|\s*:?-/.test(line) && !/^\|\s*Arquivo\s*\|/i.test(line);
}

/** O app de uma seção `## Nome (...)`: o nome do app é a primeira palavra. */
function sectionApp(line, apps) {
  const word = /^##\s+([^\s(]+)/.exec(line)?.[1]?.toLowerCase();
  return apps.find((app) => app.name.toLowerCase() === word)?.name ?? null;
}

export function parseFeatureMap(markdown, apps) {
  let app = null;
  const screens = [];
  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) app = sectionApp(line, apps);
    else if (app && isDataRow(line)) screens.push(screenFromRow(app, line));
  }
  return screens;
}

function withoutGroups(segments) {
  return segments.filter((segment) => !/^\(.+\)$/.test(segment));
}

export function routeOf(framework, file) {
  if (framework === 'next') return `/${withoutGroups(file.split('/').slice(0, -1)).join('/')}`;
  const segments = withoutGroups(file.replace(/(\.web|\.native)?\.[jt]sx?$/, '').split('/'));
  if (segments.at(-1) === 'index') segments.pop();
  return `/${segments.join('/')}`;
}

function isScreenFile(framework, file) {
  if (framework === 'next') return NEXT_SCREEN.test(file);
  if (framework === 'expo-router') return /\.[jt]sx?$/.test(file) && !EXPO_NOT_SCREEN.test(file) && !/\.(test|spec)\./.test(file);
  return false;
}

/** Os arquivos de tela que o repo tem hoje, nos apps com roteamento por arquivo. */
export function screenFiles(apps, files) {
  return apps
    .filter((app) => app.routesDir)
    .flatMap((app) =>
      files
        .filter((path) => path.startsWith(app.routesDir))
        .map((path) => path.slice(app.routesDir.length))
        .filter((file) => isScreenFile(app.framework, file))
        .map((file) => ({ app: app.name, file, route: routeOf(app.framework, file) })),
    );
}

/** Tela sem linha no mapa e linha sem tela: o mapa que ficou para trás. */
export function mapGaps(apps, screens, files) {
  const existing = screenFiles(apps, files);
  const key = ({ app, file }) => `${app} ${file}`;
  const listed = new Set(screens.map(key));
  const present = new Set(existing.map(key));
  const deducible = new Set(apps.filter((app) => app.routesDir).map((app) => app.name));
  return {
    missing: existing.filter((screen) => !listed.has(key(screen))),
    stale: screens.filter((screen) => deducible.has(screen.app) && !present.has(key(screen))),
  };
}

/** A tela que o arquivo desenha, se ele for o arquivo de uma. */
export function screenOfFile(apps, screens, path) {
  return screens.find((screen) => {
    const app = apps.find((entry) => entry.name === screen.app);
    return app && screenRoot(app) + screen.file === path;
  }) ?? null;
}
