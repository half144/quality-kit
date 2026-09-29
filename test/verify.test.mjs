import assert from 'node:assert/strict';
import { test } from 'node:test';

import { affectedScreens, featureFolderOf, isUiFile, targetsOf } from '../src/verify/affected.mjs';
import { normalizeApps, parseTarget, targetKey } from '../src/verify/apps.mjs';
import { mapGaps, parseFeatureMap, routeOf, screenFiles } from '../src/verify/feature-map.mjs';
import { owningImporters, importersOf } from '../src/verify/import-graph.mjs';
import { withMissingRows } from '../src/verify/map-command.mjs';
import { proofProblem } from '../src/verify/proof.mjs';
import { buildReport, screenshotName } from '../src/verify/verify.mjs';

const APPS = normalizeApps({
  apps: [
    { name: 'web', src: 'apps/web/src', routes: { dir: 'apps/web/src/app', framework: 'next' }, featuresDir: 'apps/web/src/features' },
    { name: 'expo', src: 'apps/expo/src', routes: { dir: 'apps/expo/src/app', framework: 'expo-router' } },
    { name: 'spa', src: 'spa/src' },
  ],
});

const MAP = `# Mapa

## Web (\`apps/web\`)

| Arquivo | Rota | Abrir em | Resumo | Feature |
| --- | --- | --- | --- | --- |
| \`(app)/conta/page.tsx\` | \`/conta\` | \`/conta\` | Conta | \`features/conta\` |
| \`evento/[id]/page.tsx\` | \`/evento/[id]\` | \`/evento/demo\` | Evento | \`features/painel\` |
| \`admin/page.tsx\` | \`/admin\` | precisa de login | Admin | |

## Expo (\`apps/expo\`)

| Arquivo | Rota | Abrir em | Resumo | Feature |
| --- | --- | --- | --- | --- |
| \`(tabs)/index.tsx\` | \`/\` | \`/\` | Início | |

## Spa

| Arquivo | Rota | Abrir em | Resumo | Feature |
| --- | --- | --- | --- | --- |
| \`App.tsx\` | \`/\` | \`/\` | Tela | |
`;

const SCREENS = parseFeatureMap(MAP, APPS);

test('o mapa vira dado, com a seção de cada app', () => {
  assert.equal(SCREENS.length, 5);
  assert.deepEqual(SCREENS[2], { app: 'web', file: 'admin/page.tsx', route: '/admin', open: null, reason: 'precisa de login', summary: 'Admin', features: [] });
  assert.equal(SCREENS[3].app, 'expo');
  assert.equal(SCREENS[4].app, 'spa');
});

test('dedução de rotas do Next e do Expo Router', () => {
  assert.equal(routeOf('next', '(app)/conta/page.tsx'), '/conta');
  assert.equal(routeOf('next', 'page.tsx'), '/');
  assert.equal(routeOf('expo-router', '(tabs)/index.tsx'), '/');
  assert.equal(routeOf('expo-router', 'evento/[id].web.tsx'), '/evento/[id]');
  const files = ['apps/web/src/app/(app)/conta/page.tsx', 'apps/web/src/app/layout.tsx', 'apps/expo/src/app/_layout.tsx', 'apps/expo/src/app/perfil.tsx'];
  assert.deepEqual(screenFiles(APPS, files).map(({ app, route }) => `${app} ${route}`), ['web /conta', 'expo /perfil']);
});

test('mapGaps: rota sem linha e linha sem rota (só nos apps com rota por arquivo)', () => {
  const files = ['apps/web/src/app/(app)/conta/page.tsx', 'apps/web/src/app/novo/page.tsx', 'apps/expo/src/app/(tabs)/index.tsx'];
  const { missing, stale } = mapGaps(APPS, SCREENS, files);
  assert.deepEqual(missing.map(({ file }) => file), ['novo/page.tsx']);
  assert.deepEqual(stale.map(({ file }) => file), ['evento/[id]/page.tsx', 'admin/page.tsx']);
});

test('arquivo de UI obriga prova; teste e lógica pura fora da rota não', () => {
  assert.ok(isUiFile(APPS, 'apps/web/src/features/conta/components/card.tsx'));
  assert.ok(isUiFile(APPS, 'apps/web/src/app/layout.ts'));
  assert.ok(!isUiFile(APPS, 'apps/web/src/features/conta/utils/x.ts'));
  assert.ok(!isUiFile(APPS, 'apps/web/src/features/conta/components/card.test.tsx'));
  assert.ok(!isUiFile(APPS, 'packages/shared/src/a.tsx'));
});

test('pasta de feature e sub-feature', () => {
  const [web] = APPS;
  assert.equal(featureFolderOf(web, 'apps/web/src/features/conta/components/a.tsx'), 'features/conta');
  assert.equal(featureFolderOf(web, 'apps/web/src/features/painel/fotos/components/a.tsx'), 'features/painel/fotos');
  assert.equal(featureFolderOf(web, 'apps/web/src/lib/a.ts'), null);
});

test('telas afetadas: rota, feature, layout e compartilhado pelos importadores', () => {
  const none = () => [];
  const names = (files, importersFor = none) => affectedScreens(APPS, SCREENS, files, importersFor).map((screen) => `${screen.app} ${screen.file}`);
  assert.deepEqual(names(['apps/web/src/app/(app)/conta/page.tsx']), ['web (app)/conta/page.tsx']);
  assert.deepEqual(names(['apps/web/src/features/painel/fotos/components/a.tsx']), ['web evento/[id]/page.tsx']);
  assert.deepEqual(names(['apps/web/src/app/(app)/layout.tsx']), ['web (app)/conta/page.tsx']);
  assert.deepEqual(names(['apps/web/src/lib/sem-dono.ts']), ['web (app)/conta/page.tsx', 'web evento/[id]/page.tsx', 'web admin/page.tsx']);
  const viaConta = (app, path, isOwner) => ['apps/web/src/features/conta/hooks/use-x.ts'].filter(isOwner);
  assert.deepEqual(names(['apps/web/src/lib/formata.ts'], viaConta), ['web (app)/conta/page.tsx']);
  assert.deepEqual(names(['spa/src/App.tsx']), ['spa App.tsx']);
});

test('grafo de imports sobe até o dono', () => {
  const sources = { 'src/a.ts': "import { b } from './b';", 'src/b.ts': "import { c } from '@/c';", 'src/c.ts': '' };
  const importers = importersOf(Object.keys(sources), { srcRoot: 'src', read: (file) => sources[file] });
  assert.deepEqual(owningImporters('src/c.ts', importers, (file) => file === 'src/a.ts'), ['src/a.ts']);
});

test('alvos: só telas com prova, sem repetir caminho', () => {
  assert.deepEqual(targetsOf(SCREENS), [
    { app: 'web', path: '/conta' },
    { app: 'web', path: '/evento/demo' },
    { app: 'expo', path: '/' },
    { app: 'spa', path: '/' },
  ]);
});

test('alvo na linha de comando: sem prefixo é o primeiro app', () => {
  assert.deepEqual(parseTarget(APPS, '/conta'), { app: 'web', path: '/conta' });
  assert.deepEqual(parseTarget(APPS, 'expo:/perfil'), { app: 'expo', path: '/perfil' });
  assert.throws(() => parseTarget(APPS, 'conta'), /não é um caminho/);
  assert.throws(() => parseTarget(APPS, 'nada:/x'), /Não há app/);
  assert.equal(targetKey(APPS, { app: 'expo', path: '/' }), 'expo:/');
});

test('prova: sem relatório, relatório velho, tela reprovada e em dia', () => {
  const targets = [{ app: 'web', path: '/conta' }];
  const ok = { results: [{ app: 'web', path: '/conta', ok: true }], tree: 't1' };
  assert.match(proofProblem({ apps: APPS, report: null, tree: 't1', targets }), /Não há relatório/);
  assert.match(proofProblem({ apps: APPS, report: ok, tree: 't2', targets }), /outro estado/);
  assert.match(proofProblem({ apps: APPS, report: { ...ok, results: [{ app: 'web', path: '/conta', ok: false }] }, tree: 't1', targets }), /não aprova/);
  assert.equal(proofProblem({ apps: APPS, report: ok, tree: 't1', targets }), null);
  assert.equal(proofProblem({ apps: APPS, report: null, tree: 't1', targets: [] }), null);
});

test('relatório: árvore que mudou no meio reprova', () => {
  const results = [{ ok: true }];
  assert.equal(buildReport({ tree: 'a', treeAfter: 'a', date: 'd', requested: [], results }).ok, true);
  assert.equal(buildReport({ tree: 'a', treeAfter: 'b', date: 'd', requested: [], results }).ok, false);
  assert.equal(screenshotName({ app: 'web', path: '/', device: 'mobile' }), 'web-raiz-mobile.png');
});

test('map --write acrescenta a linha no fim da tabela do app', () => {
  const written = withMissingRows(MAP, APPS, [{ app: 'expo', file: 'perfil.tsx', route: '/perfil' }]);
  const lines = written.split('\n');
  const row = lines.findIndex((line) => line.includes('perfil.tsx'));
  assert.equal(lines[row - 1], '| `(tabs)/index.tsx` | `/` | `/` | Início | |');
  assert.equal(parseFeatureMap(written, APPS).find((screen) => screen.file === 'perfil.tsx').open, '/perfil');
});
