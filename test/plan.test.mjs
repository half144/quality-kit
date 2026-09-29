import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { branchSlug } from '../src/branch/state.mjs';
import { hasCodeChanges, planProblem } from '../src/plan/plan-check.mjs';
import { MAX_LINES, parsePlan, planErrors, planHash, planStatus } from '../src/plan/plan.mjs';
import { approvePlan, readPlan, writePlan } from '../src/plan/store.mjs';

const PLAN = `Goal: the owner sees the event total on the dashboard
Context: today the total only shows up in the export
Where:
- src/features/panel/total-card.tsx
- src/features/panel/use-total.ts
How it works: the card reads the total from the query the panel already loads.
Proof: desktop and phone screenshots of the dashboard`;

test('tiny plan: the five sections in order pass, with lists under a label', () => {
  assert.deepEqual(planErrors(PLAN), []);
  const { sections } = parsePlan(PLAN);
  assert.deepEqual(sections.map((section) => section.label), ['Goal', 'Context', 'Where', 'How it works', 'Proof']);
  assert.equal(sections[2].text, '- src/features/panel/total-card.tsx\n- src/features/panel/use-total.ts');
});

test('tiny plan: in Portuguese too, with the project labels', () => {
  const plan = 'Objetivo: a\nContexto: b\nOnde: c\nComo funciona: d\nProva: e';
  assert.deepEqual(planErrors(plan), []);
});

test('tiny plan: too long, out of order, missing or empty sections fail', () => {
  const long = `${PLAN}\n${Array.from({ length: MAX_LINES }, (_, index) => `- line ${index}`).join('\n')}`;
  assert.match(planErrors(long).join(), /at most 15/);
  assert.match(planErrors(PLAN.replace('Goal:', 'Objective:')).join(), /must start with "Goal:"/);
  assert.match(planErrors('Goal: a\nWhere: c\nContext: b\nHow it works: d\nProof: e').join(), /exactly, in this order/);
  assert.match(planErrors('Goal: a\nContext: b\nWhere: c\nHow it works: d').join(), /exactly, in this order/);
  assert.match(planErrors('Goal: a\nContext:\nWhere: c\nHow it works: d\nProof: e').join(), /"Context:" is empty/);
  assert.match(planErrors('Objetivo: a\nContext: b\nWhere: c\nHow it works: d\nProof: e').join(), /exactly, in this order/);
});

test('approval is bound to the hash: whitespace at the ends does not matter, an edit does', () => {
  assert.equal(planHash(`\n${PLAN}\n\n`), planHash(PLAN));
  const approval = { hash: planHash(PLAN) };
  assert.equal(planStatus(null, null), 'missing');
  assert.equal(planStatus(PLAN, null), 'draft');
  assert.equal(planStatus(PLAN, approval), 'approved');
  assert.equal(planStatus(PLAN.replace('total', 'sum'), approval), 'stale');
});

test('store: write, approve, and an edit after the ok takes it away', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qk-plan-'));
  try {
    assert.equal(readPlan(dir).status, 'missing');
    assert.throws(() => approvePlan(dir), /no tiny plan/);
    assert.throws(() => writePlan(dir, 'do it'), /Not a tiny plan/);
    assert.equal(writePlan(dir, PLAN).status, 'draft');
    const approved = approvePlan(dir, new Date('2026-09-29T12:00:00Z'));
    assert.equal(approved.status, 'approved');
    assert.equal(approved.approval.approvedAt, '2026-09-29T12:00:00.000Z');
    assert.equal(writePlan(dir, `${PLAN}\n`).status, 'approved');
    assert.equal(writePlan(dir, PLAN.replace('dashboard', 'panel')).status, 'stale');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('plan rule: code changes need an approved plan; docs alone do not', () => {
  assert.ok(hasCodeChanges(['README.md', 'src/a.ts']));
  assert.ok(!hasCodeChanges(['README.md', 'docs/guide.mdx']));
  assert.match(planProblem('missing'), /write a tiny plan with the tiny-plan skill and get the owner's ok/);
  assert.match(planProblem('draft'), /not approved/);
  assert.match(planProblem('stale'), /changed after the owner approved/);
  assert.equal(planProblem('approved'), null);
});

test('branch folders: one per branch name, safe on disk', () => {
  assert.equal(branchSlug('feat/total card'), 'feat__total-card');
  assert.equal(branchSlug('main'), 'main');
});
