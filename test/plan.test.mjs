import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { branchSlug } from '../src/branch/state.mjs';
import { awaitingOk, hasCodeChanges, planProblem } from '../src/plan/plan-check.mjs';
import { LIMITS, planErrors } from '../src/plan/limits.mjs';
import { parsePlan, planHash, planStatus, TEMPLATE } from '../src/plan/plan.mjs';
import { renderPlan } from '../src/plan/render.mjs';
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

const PLANO = `Objetivo: a tela de pagamento segue o padrão do painel, sem mudar preço nem regra
Contexto: /event-payment ainda usa a voz antiga do app.
Onde:
- payment-pitch.tsx: título em serifa, preço grande
- pix/focus-surface.tsx: sem sombra, ring de um fio
Como funciona: o fluxo não muda (gera Pix, copia, cartão, cupom)
só a pele: tokens do DESIGN.md, celular primeiro
Prova: prints de /event-payment (desktop e celular)`;

// The plan from the session that failed on the first write: a note inside the label, then walls of text.
const WALL = `Objetivo: a tela de pagamento (Pix, cartão, cupom) passa a seguir o design padrão do painel, mais limpa e bonita, sem mudar preço nem regra.
Contexto: /event-payment ainda está na voz antiga (font-black, uppercase com tracking, sombra pesada, verde solto, brilho no cartão); o padrão novo é o contrato "Painel do organizador" do DESIGN.md. Refero: checkout de duas colunas com resumo separado do pagamento (Synthesia, Douze), cupom em diálogo (Uber Eats, Instacart).
Onde (só apresentação, hooks e utils intactos):
- payment-pitch.tsx e shell/ (shell, backdrop): título em serifa de peso único, preço grande, sem eyebrow, itens incluídos em linhas com ícone ember
- pix/focus-surface.tsx: sem sombra
Como funciona: mesmo fluxo.
Prova: prints de /event-payment em desktop e celular`;

test('tiny plan: in Portuguese too, with the project labels', () => {
  assert.deepEqual(planErrors(PLANO), []);
});

test('tiny plan: the template in the usage is itself a valid plan', () => {
  assert.deepEqual(planErrors(TEMPLATE), []);
});

test('tiny plan: too long, out of order, missing or empty sections fail', () => {
  const long = `${PLAN}\n${Array.from({ length: LIMITS.lines }, (_, index) => `- line ${index}`).join('\n')}`;
  assert.match(planErrors(long).join(), /at most 15/);
  assert.match(planErrors(PLAN.replace('Goal:', 'Objective:')).join(), /must start with "Goal:"/);
  assert.match(planErrors('Goal: a\nWhere:\n- c\nContext: b\nHow it works: d\nProof: e').join(), /exactly, in this order/);
  assert.match(planErrors('Goal: a\nContext: b\nWhere:\n- c\nHow it works: d').join(), /"Proof:" is missing/);
  assert.match(planErrors('Goal: a\nContext:\nWhere:\n- c\nHow it works: d\nProof: e').join(), /"Context:" is empty/);
  assert.match(planErrors('Goal: a\nContext: b\nWhere:\n- c\nWhere:\n- d\nHow it works: d\nProof: e').join(), /"Where:" appears more than once/);
});

test('tiny plan: a label with a note, bold or another language says which line to fix', () => {
  const errors = planErrors(WALL);
  assert.ok(errors.some((error) => error === 'Line 3 ("Onde (só apresentação, hooks e utils int…") is read as text, not as the label "Onde:": start the line with exactly "Onde:" and move any note out of the label.'), errors.join('\n'));
  assert.ok(!errors.some((error) => /"Onde:" is missing|"Contexto:" bullet/.test(error)), 'the misnamed label is judged as the field it meant');
  assert.match(planErrors(PLANO.replace('Prova:', '**Prova:**')).join(), /Line 8 .* "Prova:"/);
  assert.match(planErrors(PLAN.replace('Where:', 'Onde:')).join(), /start the line with exactly "Where:"/);
  assert.deepEqual(planErrors(PLAN.replace('How it works: the card', 'How it works: where the card')), []);
});

test('tiny plan: an over-long line names its field and says to cut it, not wrap it', () => {
  const errors = planErrors(WALL);
  assert.ok(errors.includes('"Objetivo:" has 140 characters (limit 120): cut it, don\'t wrap it onto another line.'), errors.join('\n'));
  assert.ok(errors.includes('"Contexto:" has 325 characters (limit 120): cut it, don\'t wrap it onto another line.'), errors.join('\n'));
  assert.ok(errors.includes('"Onde:" bullet 1 has 148 characters (limit 120): cut it, don\'t wrap it onto another line.'), errors.join('\n'));
  const where = PLAN.replace('- src/features/panel/use-total.ts', `- src/features/panel/use-total.ts: ${'x'.repeat(100)}`);
  assert.match(planErrors(where).join(), /"Where:" bullet 2 has 135 characters \(limit 120\)/);
});

test('tiny plan: Where is 1 to 5 bullets, Context 2 sentences, How it works 4 lines, Goal one line', () => {
  const bullets = (count) => Array.from({ length: count }, (_, index) => `- f${index}.ts`).join('\n');
  const plan = (where) => `Goal: a\nContext: b\nWhere:\n${where}\nHow it works: d\nProof: e`;
  assert.deepEqual(planErrors(plan(bullets(5))), []);
  assert.match(planErrors(plan(bullets(6))).join(), /"Where:" has 6 bullets: list 1 to 5/);
  assert.match(planErrors('Goal: a\nContext: b\nWhere: c.ts\nHow it works: d\nProof: e').join(), /"Where:" is a list/);
  assert.match(planErrors(PLAN.replace('only shows up in the export', 'is in the export. It is slow. Nobody uses it.')).join(), /"Context:" has 3 sentences on 1 lines: at most 2 short sentences\. Research and design references stay in your work/);
  assert.deepEqual(planErrors(PLAN.replace('only shows up in the export', 'is only in the export. See DESIGN.md for the card.')), []);
  assert.match(planErrors(PLAN.replace('loads.', 'loads.\n- a\n- b\n- c\n- d')).join(), /"How it works:" has 5 lines: at most 4/);
  assert.match(planErrors(PLAN.replace('dashboard\n', 'dashboard\nand also the export\n')).join(), /"Goal:" has 2 lines: one line/);
});

test('render: markdown the owner scans in seconds, in the plan\'s own labels', () => {
  assert.equal(renderPlan(PLANO), [
    '**Objetivo:** a tela de pagamento segue o padrão do painel, sem mudar preço nem regra',
    '',
    '**Contexto:** /event-payment ainda usa a voz antiga do app.',
    '',
    '**Onde**',
    '- `payment-pitch.tsx`: título em serifa, preço grande',
    '- `pix/focus-surface.tsx`: sem sombra, ring de um fio',
    '',
    '**Como funciona**',
    '- o fluxo não muda (gera Pix, copia, cartão, cupom)',
    '- só a pele: tokens do DESIGN.md, celular primeiro',
    '',
    '**Prova:** prints de /event-payment (desktop e celular)',
  ].join('\n'));
  const english = renderPlan(PLAN);
  assert.match(english, /^\*\*Goal:\*\* the owner sees the event total on the dashboard\n\n\*\*Context:\*\*/);
  assert.match(english, /\*\*Where\*\*\n- `src\/features\/panel\/total-card\.tsx`\n- `src\/features\/panel\/use-total\.ts`/);
  assert.ok(!english.includes('```'));
});

test('render: only a leading path gets inline code, and code already there stays', () => {
  const plan = (bullet) => renderPlan(`Goal: a\nContext: b\nWhere:\n- ${bullet}\nHow it works: d\nProof: e`);
  assert.match(plan('the /guests screen: a button'), /- the \/guests screen: a button/);
  assert.match(plan('`a.tsx` and `b.tsx`: shared'), /- `a\.tsx` and `b\.tsx`: shared/);
  assert.match(plan('1.5x faster: no'), /- 1\.5x faster: no/);
  assert.match(plan('/event-payment'), /- `\/event-payment`/);
});

test('render: a plan saved by an older version still renders, approves and ships', () => {
  const old = 'Goal: the host sees how many guests confirmed\nContext: nobody confirmed shows up, with no way to change it\nWhere: src/features/guests/guest-list.tsx, the /guests screen\nHow it works: a "Confirm" button adds one to the count.\nProof: desktop and phone stills of /guests';
  assert.equal(renderPlan(old).split('\n\n')[2], '**Where:** src/features/guests/guest-list.tsx, the /guests screen');
  // The second write of that session, which the old version saved as is.
  const saved = WALL.replace('Onde (só apresentação, hooks e utils intactos):', 'Onde:');
  assert.equal(renderPlan(saved).split('\n\n')[2], '**Onde**\n- payment-pitch.tsx e shell/ (shell, backdrop): título em serifa de peso único, preço grande, sem eyebrow, itens incluídos em linhas com ícone ember\n- `pix/focus-surface.tsx`: sem sombra');
  const dir = mkdtempSync(join(tmpdir(), 'qk-plan-'));
  try {
    writeFileSync(join(dir, 'plan.md'), `${saved}\n`);
    assert.equal(readPlan(dir).status, 'draft');
    assert.equal(approvePlan(dir).status, 'approved');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
    assert.throws(() => writePlan(dir, 'do it'), /Not a tiny plan[\s\S]*run `quality-kit plan write` again/);
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

test('awaiting the ok: a saved, unapproved plan with no code moved since it was saved', () => {
  const written = { changes: 'abc' };
  assert.equal(awaitingOk({ status: 'draft', written }, 'abc'), true);
  assert.equal(awaitingOk({ status: 'stale', written }, 'abc'), true);
  assert.equal(awaitingOk({ status: 'draft', written }, 'def'), false);
  assert.equal(awaitingOk({ status: 'approved', written }, 'abc'), false);
  assert.equal(awaitingOk({ status: 'draft', written: null }, 'abc'), false);
  assert.equal(awaitingOk({ status: 'draft', written: { changes: null } }, 'abc'), false);
});

test('store: the plan remembers the change fingerprint it was saved on', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qk-plan-'));
  try {
    assert.equal(readPlan(dir).written, null);
    assert.deepEqual(writePlan(dir, PLAN, 'abc').written, { changes: 'abc' });
    assert.deepEqual(writePlan(dir, PLAN).written, { changes: null });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('branch folders: one per branch name, safe on disk', () => {
  assert.equal(branchSlug('feat/total card'), 'feat__total-card');
  assert.equal(branchSlug('main'), 'main');
});
