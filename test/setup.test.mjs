import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildConfig } from '../src/setup/config-builder.mjs';
import { shapeOf, stackOf, workspacePatterns } from '../src/setup/detect.mjs';
import { architectureDoc, featureMapDoc } from '../src/setup/docs.mjs';
import { hookBlock, mergeHook } from '../src/setup/githooks.mjs';
import { hookNames } from '../src/setup/init.mjs';
import { agentsSnippet, DENY, mergeAgents, mergeDeny, workflowSource } from '../src/setup/team.mjs';
import { flagsToOptions, overlaySource } from '../src/lint/overlay.mjs';
import { parseFeatureMap } from '../src/verify/feature-map.mjs';
import { normalizeApps } from '../src/verify/apps.mjs';

const FILES = ['src/App.tsx', 'src/main.tsx', 'src/components/Button.tsx', 'src/components/Card.tsx', 'src/hooks/useChat.ts', 'src/hooks/useChat.test.ts', 'src/lib/index.ts'];

const VITE = {
  dir: '',
  stack: stackOf({ dependencies: { react: '19', vite: '6' }, devDependencies: { vitest: '3' } }, () => false),
  scripts: {},
  tsconfigs: ['tsconfig.json'],
  src: 'src',
  routes: null,
  convexDir: null,
  shape: shapeOf(FILES, 'src'),
};

test('detect: stack, workspaces and code shape', () => {
  assert.equal(VITE.stack.test, 'vitest');
  assert.ok(VITE.stack.vite && VITE.stack.react && !VITE.stack.next);
  assert.deepEqual(workspacePatterns({ workspaces: ['apps/*'] }, "packages:\n  - 'packages/*'\n"), ['apps/*', 'packages/*']);
  assert.deepEqual(VITE.shape.topFolders, ['components', 'hooks', 'lib']);
  assert.deepEqual(VITE.shape.naming, { files: 'camel', components: 'pascal', folders: 'kebab' });
  assert.equal(VITE.shape.barrels, 1);
});

test('"keep" config: today\'s shape becomes the ruleset', () => {
  const config = buildConfig({ packages: [VITE], base: 'origin/main', packageManager: 'npm' }, { mode: 'local', architecture: 'keep' });
  const [root] = config.architecture.roots;
  assert.deepEqual(root.allowedTop, ['components', 'hooks', 'lib']);
  assert.equal(root.noBarrel, false);
  assert.equal(config.status, 'pending');
  assert.equal(config.verify.apps[0].name, 'web');
  assert.match(config.verify.apps[0].start.command, /vite --port \{port\}/);
  assert.ok(!('ci' in config));
});

test('"suggest" config: feature-based layout, kebab case and no barrels; team mode with CI', () => {
  const config = buildConfig({ packages: [VITE], base: 'origin/main', packageManager: 'pnpm' }, { mode: 'team', architecture: 'suggest' });
  const [root] = config.architecture.roots;
  assert.ok(root.allowedTop.includes('features'));
  assert.deepEqual(root.naming, { files: 'kebab', components: 'kebab', folders: 'kebab' });
  assert.equal(root.noBarrel, true);
  assert.equal(config.ci.install.run, 'pnpm install --frozen-lockfile');
  assert.ok(config.integrity.protect.includes('.github/workflows/quality.yml'));
});

test('docs: the ruleset as text and the map with the entry screen', () => {
  const config = buildConfig({ packages: [VITE], base: 'origin/main', packageManager: 'npm' }, { mode: 'local' });
  assert.match(architectureDoc(config), /Allowed top-level folders: `components`, `hooks`, `lib`/);
  const map = featureMapDoc(config, FILES);
  const apps = normalizeApps(config.verify);
  assert.deepEqual(parseFeatureMap(map, apps).map(({ file, open }) => `${file} ${open}`), ['App.tsx /']);
});

test('git hooks: a new one, or the existing one with the block before exit 0', () => {
  assert.ok(mergeHook(null, 'pre-push').startsWith('#!/bin/sh\n# quality-kit'));
  const merged = mergeHook('#!/bin/sh\necho oi\nexit 0\n', 'pre-push');
  assert.ok(merged.indexOf('# quality-kit') < merged.lastIndexOf('exit 0'));
  assert.equal(mergeHook(merged, 'pre-push'), merged);
  assert.match(hookBlock('pre-commit'), /git-hook pre-commit/);
});

test('team mode: merged deny list, AGENTS.md between markers and workflow pinned to the kit version', () => {
  const settings = mergeDeny({ permissions: { deny: ['Edit(/x)'] }, hooks: {} });
  assert.deepEqual(settings.permissions.deny, ['Edit(/x)', ...DENY]);
  const agents = mergeAgents('# A\n\ntexto', '<!-- quality-kit:start -->\nnovo\n<!-- quality-kit:end -->\n');
  assert.equal(mergeAgents(agents, '<!-- quality-kit:start -->\noutro\n<!-- quality-kit:end -->\n').match(/quality-kit:start/g).length, 1);
  const workflow = workflowSource({ runsOn: ['self-hosted', 'vps'], install: { uses: './.github/actions/deps' } }, '9.9.9');
  assert.match(workflow, /runs-on: \[self-hosted, vps\]/);
  assert.match(workflow, /--branch v9\.9\.9/);
  assert.match(workflow, /regua-aprovada/);
});

test('ESLint config: project underneath, kit preset and extras on top', () => {
  const source = overlaySource({ deps: '/deps', presetPath: '/kit/preset.cjs', projectConfig: '/repo/eslint.config.js', extraRules: '/regua/lint-extra.cjs', tsconfigRootDir: '/repo', ignores: ['**/dist/**'] });
  assert.match(source, /await import\("file:\/\/\/repo\/eslint\.config\.js"\)/);
  assert.match(source, /kitRequire\("\/regua\/lint-extra\.cjs"\)/);
  assert.match(overlaySource({ deps: '/d', presetPath: '/p', projectConfig: null, extraRules: null, tsconfigRootDir: '/r', ignores: [] }), /js\.configs\.recommended/);
});

test('tsc flags become compilerOptions in the strict lint tsconfig', () => {
  assert.deepEqual(flagsToOptions(['--strict', '--target', 'es2022', '--noUncheckedIndexedAccess']), { strict: true, target: 'es2022', noUncheckedIndexedAccess: true });
});

test('a hook turned off in the ruleset is not installed', () => {
  assert.deepEqual(hookNames({ preCommit: 'off', prePush: 'fast' }), ['pre-push']);
  assert.deepEqual(hookNames({ preCommit: 'fast', prePush: 'full' }), ['pre-commit', 'pre-push']);
});

test('the AGENTS.md snippet points to the project docs', () => {
  assert.match(agentsSnippet({ docs: { architecture: 'docs/ARCHITECTURE.md', map: null } }), /`docs\/ARCHITECTURE\.md`[\s\S]*`\.quality\/FEATURE_MAP\.md`/);
});

test('runtime key: the dependency set, not the kit version', async () => {
  const { depsKey } = await import('../src/runtime.mjs');
  const lock = (version, eslint) => ({ packages: { '': { name: 'quality-kit', version }, 'node_modules/eslint': { version: eslint } } });
  assert.equal(depsKey(lock('0.3.2', '9.39.4')), depsKey(lock('0.3.3', '9.39.4')));
  assert.notEqual(depsKey(lock('0.3.3', '9.39.4')), depsKey(lock('0.3.3', '9.40.0')));
  assert.match(depsKey(), /^[0-9a-f]{12}$/);
});
