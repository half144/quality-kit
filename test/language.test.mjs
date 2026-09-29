import assert from 'node:assert/strict';
import { test } from 'node:test';

import { architectureDoc, featureMapDoc, lintExtraTemplate, playbooksDoc } from '../src/setup/docs.mjs';
import { hookBlock } from '../src/setup/githooks.mjs';
import { languageOf, mapLanguage } from '../src/setup/language.mjs';
import { agentsSnippet, workflowSource } from '../src/setup/team.mjs';
import { normalizeApps } from '../src/verify/apps.mjs';
import { parseFeatureMap } from '../src/verify/feature-map.mjs';
import { withMissingRows } from '../src/verify/map-command.mjs';

const CONFIG = {
  architecture: { roots: [{ path: 'src', allowedTop: ['lib'], noBarrel: true }], folderSize: null },
  verify: { apps: [{ name: 'web', src: 'src', routes: { dir: 'src/app', framework: 'next' } }] },
  workspaces: [{ dir: '', test: 'vitest' }],
};
const FILES = ['src/app/page.tsx', 'src/app/evento/[id]/page.tsx'];
const DETECTION = { packageManager: 'npm', packages: [{ dir: '', scripts: {} }] };
const CI = { runsOn: 'ubuntu-latest', install: { run: 'npm ci' } };

test('language: English unless the config says pt-BR', () => {
  assert.equal(languageOf({}), 'en');
  assert.equal(languageOf({ language: 'fr' }), 'en');
  assert.equal(languageOf({ language: 'pt-BR' }), 'pt-BR');
});

test('generated docs are in English by default', () => {
  assert.match(architectureDoc(CONFIG), /^# Architecture\n[\s\S]*Allowed top-level folders: `lib`[\s\S]*No barrels/);
  const map = featureMapDoc(CONFIG, FILES);
  assert.match(map, /\| File \| Route \| Open at \| Summary \| Feature \|/);
  assert.match(map, /`\/evento\/\[id\]` \| needs demo data \|/);
  assert.match(playbooksDoc(DETECTION, CONFIG), /# Playbooks supplement[\s\S]*no scripts in package\.json/);
  assert.match(lintExtraTemplate(CONFIG), /This project's own lint rules[\s\S]*module\.exports/);
});

test('generated docs are in Portuguese for a pt-BR project', () => {
  const config = { ...CONFIG, language: 'pt-BR' };
  assert.match(architectureDoc(config), /^# Arquitetura\n[\s\S]*Pastas do topo permitidas: `lib`/);
  assert.match(featureMapDoc(config, FILES), /\| Arquivo \| Rota \| Abrir em \| Resumo \| Feature \|[\s\S]*precisa de dado de demonstração/);
  assert.match(playbooksDoc(DETECTION, config), /# Complemento dos playbooks/);
  assert.match(lintExtraTemplate(config), /Regras de lint próprias deste projeto/);
});

test('both map languages parse to the same screens', () => {
  const apps = normalizeApps(CONFIG.verify);
  const english = parseFeatureMap(featureMapDoc(CONFIG, FILES), apps);
  const portuguese = parseFeatureMap(featureMapDoc({ ...CONFIG, language: 'pt-BR' }, FILES), apps);
  assert.deepEqual(english.map(({ file, open }) => `${file} ${open}`), ['page.tsx /', 'evento/[id]/page.tsx null']);
  assert.deepEqual(portuguese.map(({ file, open }) => `${file} ${open}`), english.map(({ file, open }) => `${file} ${open}`));
});

test('map --write keeps the language the map was written in', () => {
  const apps = normalizeApps(CONFIG.verify);
  const missing = [{ app: 'web', file: 'x/[id]/page.tsx', route: '/x/[id]' }];
  const portuguese = featureMapDoc({ ...CONFIG, language: 'pt-BR' }, FILES);
  assert.equal(mapLanguage(portuguese), 'pt-BR');
  assert.match(withMissingRows(portuguese, apps, missing), /`\/x\/\[id\]` \| precisa de dado de demonstração \|/);
  assert.match(withMissingRows(featureMapDoc(CONFIG, FILES), apps, missing), /`\/x\/\[id\]` \| needs demo data \|/);
});

test('workflow, git hook and AGENTS.md snippet follow the language', () => {
  assert.match(workflowSource(CI, '0.2.0'), /name: Install the quality-kit/);
  assert.match(workflowSource(CI, '0.2.0', 'pt-BR'), /name: Instalar o quality-kit/);
  assert.match(hookBlock('pre-push'), /the ruleset gate \(pre-push\)/);
  assert.match(hookBlock('pre-push', 'pt-BR'), /o gate da régua \(pre-push\)/);
  assert.match(agentsSnippet({ docs: {} }), /## Quality \(quality-kit\)/);
  assert.match(agentsSnippet({ docs: {}, language: 'pt-BR' }), /## Qualidade \(quality-kit\)/);
});
