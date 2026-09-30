import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { renderPlan } from '../src/plan/render.mjs';
import { prBody, prTitle } from '../src/ship/body.mjs';
import { prArgs } from '../src/ship/github.mjs';
import { baseBranch, mediaItems, shipBlockers } from '../src/ship/ship.mjs';
import { contentTypeOf, uploadAll, uploadAsset, uploadRequest } from '../src/ship/upload.mjs';

const PLAN = 'Goal: the total shows on the dashboard\nContext: only the export has it\nWhere:\n- total-card.tsx\n- use-total.ts\nHow it works: the card reads the loaded query\nProof: dashboard screenshots';

test('PR body: plan, evidence embedded, then the gate summary', () => {
  const evidence = [
    { kind: 'still', screen: '/painel', device: 'desktop', caption: 'Actual: 0 · Expected: 120', url: 'https://github.com/user-attachments/assets/a' },
    { kind: 'video', screen: '/painel', device: 'phone', caption: null, url: 'https://github.com/user-attachments/assets/b' },
    { kind: 'still', screen: '/conta', device: 'phone', caption: null, path: '/tmp/conta-phone.framed.png' },
  ];
  const body = prBody({ language: 'en', plan: PLAN, evidence, checks: ['architecture', 'lint', 'verify'] });
  const order = ['## Plan', '**Goal:** the total shows', '**Where**\n- `total-card.tsx`\n- `use-total.ts`', '## Evidence', '![/painel (Desktop)](https://github.com/user-attachments/assets/a)', '> Actual: 0 · Expected: 120', '**/painel (Phone)**\n\nhttps://github.com/user-attachments/assets/b', 'Local file (not uploaded): `/tmp/conta-phone.framed.png`', '## Gate', 'passed on this change: architecture, type-aware lint, screens opened on desktop and mobile.'];
  const positions = order.map((part) => body.indexOf(part));
  assert.ok(positions.every((position) => position >= 0), body);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('PR body: the project language, and no screens means no media', () => {
  const body = prBody({ language: 'pt-BR', plan: 'Objetivo: a\nContexto: b\nOnde: c\nComo funciona: d\nProva: e', evidence: [], checks: ['tests'] });
  assert.match(body, /^## Plano\n\n\*\*Objetivo:\*\* a[\s\S]*## Evidências\n\nNenhuma tela mudou[\s\S]*## Gate\n\nO quality-kit passou nesta mudança: testes relacionados\.$/);
});

test('PR body: the plan section is the same rendering the owner saw in chat', () => {
  const body = prBody({ language: 'en', plan: PLAN, evidence: [], checks: [] });
  assert.ok(body.startsWith(`## Plan\n\n${renderPlan(PLAN)}\n\n## Evidence`), body);
});

test('PR title: the goal line', () => {
  assert.equal(prTitle(PLAN), 'the total shows on the dashboard');
});

test('upload request: the user-attachments endpoint with the repo id and a bearer token', () => {
  const { url, init } = uploadRequest({ repositoryId: 42, token: 'tok', file: '/x/shot one.png', body: 'bytes' });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://uploads.github.com/user-attachments/assets');
  assert.deepEqual(Object.fromEntries(parsed.searchParams), { name: 'shot one.png', content_type: 'image/png', repository_id: '42' });
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, 'Bearer tok');
  assert.equal(contentTypeOf('/v/demo.mp4'), 'video/mp4');
  assert.throws(() => contentTypeOf('/v/notes.txt'), /png, jpg/);
});

test('upload: the file bytes go up and the asset URL comes back; a failure keeps the local path', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qk-upload-'));
  const file = join(dir, 'shot.png');
  writeFileSync(file, 'PNGDATA');
  const calls = [];
  const ok = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 201, json: async () => ({ url: 'https://github.com/user-attachments/assets/uuid' }) };
  };
  const failing = async () => ({ ok: false, status: 422, json: async () => ({ message: 'bad' }) });
  try {
    assert.equal(await uploadAsset({ repositoryId: 7, token: 't', file, fetchImpl: ok }), 'https://github.com/user-attachments/assets/uuid');
    assert.equal(Buffer.from(calls[0].init.body).toString(), 'PNGDATA');
    await assert.rejects(uploadAsset({ repositoryId: 7, token: 't', file, fetchImpl: failing }), /upload of shot\.png failed \(HTTP 422\)/);
    const { uploaded, failures } = await uploadAll([{ screen: '/', path: file }], { repositoryId: 7, token: 't', fetchImpl: failing });
    assert.deepEqual(uploaded, [{ screen: '/', path: file }]);
    assert.equal(failures.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ship refuses without an approved plan, with an evidence gap or with the gate failing', () => {
  assert.deepEqual(shipBlockers({ planStatus: 'approved', gateProblems: [], evidence: null }), []);
  const blockers = shipBlockers({ planStatus: 'missing', gateProblems: ['ESLint: no-explicit-any'], evidence: 'no evidence' });
  assert.equal(blockers.length, 3);
  assert.match(blockers[0], /tiny plan/);
  assert.equal(blockers[1], 'no evidence');
  assert.match(blockers[2], /The gate fails:\n\nESLint/);
  assert.equal(shipBlockers({ planStatus: 'stale', gateProblems: [], evidence: null }).length, 1);
});

test('ship: base branch for gh and the framed still preferred over the raw one', () => {
  assert.equal(baseBranch('origin/main'), 'main');
  assert.equal(baseBranch('develop'), 'develop');
  const items = mediaItems([{ kind: 'still', screen: '/', device: 'phone', caption: null, file: '/raw.png', framed: '/raw.framed.png', tree: 't' }, { kind: 'video', screen: '/', device: 'desktop', caption: null, file: '/v.mp4', framed: null }]);
  assert.deepEqual(items.map((item) => item.path), ['/raw.framed.png', '/v.mp4']);
});

test('ship opens the PR, or rewrites the open one when it ships again', () => {
  const pr = { title: 'T', bodyFile: '/tmp/body.md', base: 'main' };
  assert.deepEqual(prArgs({ ...pr, url: null }), ['pr', 'create', '--title', 'T', '--body-file', '/tmp/body.md', '--base', 'main']);
  assert.deepEqual(prArgs({ ...pr, url: 'https://github.com/o/r/pull/7' }), ['pr', 'edit', 'https://github.com/o/r/pull/7', '--title', 'T', '--body-file', '/tmp/body.md', '--base', 'main']);
});
