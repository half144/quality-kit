import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkFolderSizes, checkRepository, violationsIn } from '../src/architecture/checker.mjs';
import { globToRegExp, matchesAny } from '../src/architecture/glob.mjs';

const FEATURES = { dir: 'features', layers: ['api', 'components', 'hooks', 'utils'] };
const WEB = {
  path: 'apps/web/src',
  allowedTop: ['app', 'components', 'features', 'lib'],
  rootFiles: ['proxy.ts'],
  naming: { files: 'kebab', components: 'kebab', folders: 'kebab' },
  noBarrel: true,
  testsColocated: true,
  routes: { dir: 'app', framework: 'next' },
  features: FEATURES,
};

function check(roots, files, sources = {}) {
  return checkRepository({ roots }, files, (file) => sources[file] ?? '').map(({ file, rule }) => `${rule} ${file}`);
}

test('glob: **, * and braces', () => {
  assert.ok(matchesAny('apps/web/src/app/x/page.tsx', ['**/src/app{,/**}']));
  assert.ok(matchesAny('apps/web/src/app', ['**/src/app{,/**}']));
  assert.ok(!matchesAny('apps/web/src/lib/a.ts', ['**/src/app{,/**}']));
  assert.ok(globToRegExp('src/*.ts').test('src/a.ts'));
  assert.ok(!globToRegExp('src/*.ts').test('src/a/b.ts'));
});

test('top-level folder outside the layout and stray file at the root', () => {
  assert.deepEqual(check([WEB], ['apps/web/src/utils/a.ts', 'apps/web/src/proxy.ts', 'apps/web/src/solto.ts']), [
    'top-folders apps/web/src/utils/a.ts',
    'root-files apps/web/src/solto.ts',
  ]);
});

test('naming by convention, with components on their own convention', () => {
  const root = { path: 'src', naming: { files: 'camel', components: 'pascal', folders: 'kebab' } };
  assert.deepEqual(check([root], ['src/main-window/useThing.ts', 'src/main-window/Button.tsx', 'src/mainWindow/x.ts', 'src/a/button.tsx']), [
    'naming src/mainWindow/x.ts',
    'naming src/a/button.tsx',
  ]);
});

test('no convention (any) accepts everything', () => {
  assert.deepEqual(check([{ path: 'src', naming: { files: 'any', components: 'any', folders: 'any' } }], ['src/Qualquer_Coisa/x-Y.ts']), []);
});

test('barrels and __tests__ forbidden when the ruleset says so', () => {
  assert.deepEqual(check([WEB], ['apps/web/src/lib/index.ts', 'apps/web/src/lib/__tests__/a.test.ts']), [
    'no-barrel apps/web/src/lib/index.ts',
    'tests-colocated apps/web/src/lib/__tests__/a.test.ts',
  ]);
});

test('the Next routes folder only accepts route files', () => {
  assert.deepEqual(check([WEB], ['apps/web/src/app/(grupo)/conta/page.tsx', 'apps/web/src/app/conta/card.tsx', 'apps/web/src/app/_x/page.tsx']), [
    'app-routes-only apps/web/src/app/conta/card.tsx',
    'app-routes-only apps/web/src/app/_x/page.tsx',
  ]);
});

test('an Expo Router route needs a default export', () => {
  const expo = { path: 'src', routes: { dir: 'app', framework: 'expo-router' } };
  const sources = { 'src/app/index.tsx': 'export default function A() {}', 'src/app/helper.ts': 'export const x = 1' };
  assert.deepEqual(check([expo], Object.keys(sources), sources), ['app-routes-only src/app/helper.ts']);
});

test('a stray file in a feature belongs in a layer', () => {
  assert.deepEqual(check([WEB], ['apps/web/src/features/conta/solto.ts', 'apps/web/src/features/conta/hooks/use-conta.ts']), [
    'feature-folders apps/web/src/features/conta/solto.ts',
  ]);
});

test('import direction: features do not import each other, shared code does not import features, only routes import routes', () => {
  const sources = {
    'apps/web/src/features/conta/hooks/use-conta.ts': "import { x } from '@/features/pagamento/utils/x';",
    'apps/web/src/lib/a.ts': "import { y } from '../features/conta/hooks/use-conta';",
    'apps/web/src/components/b.tsx': "import Page from '@/app/page';",
    'apps/web/src/features/pagamento/utils/x.ts': "import { a } from '@/lib/a';",
  };
  assert.deepEqual(check([WEB], Object.keys(sources), sources), [
    'import-direction apps/web/src/features/conta/hooks/use-conta.ts',
    'import-direction apps/web/src/lib/a.ts',
    'import-direction apps/web/src/components/b.tsx',
  ]);
});

test('a sub-feature does not import from its sibling', () => {
  const sources = { 'apps/web/src/features/painel/fotos/components/a.tsx': "import b from '@/features/painel/video/components/b';" };
  assert.deepEqual(check([WEB], Object.keys(sources), sources), ['import-direction apps/web/src/features/painel/fotos/components/a.tsx']);
});

test('imports.forbid in the config adds path-to-path rules', () => {
  const root = { path: 'src', imports: { forbid: [{ from: 'components/**', to: 'stores/**', message: 'componente recebe estado por prop' }] } };
  const sources = { 'src/components/a.tsx': "import { s } from '../stores/s';" };
  const [violation] = checkRepository({ roots: [root] }, Object.keys(sources), (file) => sources[file]);
  assert.equal(violation.rule, 'import-direction');
  assert.match(violation.message, /componente recebe estado por prop/);
});

test('Convex: camelCase, and the root only holds registered functions', () => {
  const convex = { path: 'convex', kind: 'convex' };
  const sources = {
    'convex/events.ts': 'export const list = query({})',
    'convex/helpers.ts': 'export function x() {}',
    'convex/model/evento-x.ts': '',
    'convex/schema.ts': '',
  };
  assert.deepEqual(check([convex], Object.keys(sources), sources), [
    'convex-root-api-only convex/helpers.ts',
    'convex-camel-case convex/model/evento-x.ts',
    'convex-model-domain convex/model/evento-x.ts',
  ]);
});

test('folder size: counts code, skips tests and exempt folders', () => {
  const files = [...Array.from({ length: 3 }, (_, index) => `src/a/f${index}.ts`), 'src/a/f0.test.ts', ...Array.from({ length: 3 }, (_, index) => `src/app/f${index}.ts`)];
  assert.deepEqual(
    checkFolderSizes(files, { max: 2, scopes: ['src/**'], exempt: ['src/app{,/**}'] }).map(({ file }) => file),
    ['src/a'],
  );
});

test('violationsIn: only touched files, and folder size only for whoever added a file', () => {
  const violations = [
    { file: 'src/a.ts', rule: 'naming' },
    { file: 'src/b.ts', rule: 'naming' },
    { file: 'src/x', rule: 'folder-size' },
    { file: 'src/y', rule: 'folder-size' },
  ];
  assert.deepEqual(violationsIn(violations, { changed: ['src/a.ts', 'src/y/z.ts'], added: ['src/x/n.ts'] }), [violations[0], violations[2]]);
});
