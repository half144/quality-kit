import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluate, humanAtTerminal, isSigned, REGUA_CHANGED, sign } from '../src/integrity/integrity.mjs';
import { debtGrowth, flattenSuppressions, hashEntries, parseRenames, renamedKey } from '../src/integrity/regua.mjs';

const KEY = 'chave-de-teste';

function signed(state) {
  return { ...state, signature: sign(state, KEY) };
}

test('hash da régua não depende da ordem e muda com o conteúdo', () => {
  assert.equal(hashEntries([['a', '1'], ['b', '2']]), hashEntries([['b', '2'], ['a', '1']]));
  assert.notEqual(hashEntries([['a', '1']]), hashEntries([['a', '2']]));
});

test('a assinatura cobre régua e dívida', () => {
  const record = signed({ reguaHash: 'r1', debt: { 'eslint:a.ts x': 1 } });
  assert.ok(isSigned(record, KEY));
  assert.ok(!isSigned({ ...record, debt: { 'eslint:a.ts x': 5 } }, KEY));
  assert.ok(!isSigned({ ...record, reguaHash: 'r2' }, KEY));
  assert.ok(!isSigned(record, 'outra-chave'));
});

test('régua igual à aceita e dívida igual: aprovado, sem reassinar', () => {
  const record = signed({ reguaHash: 'r1', debt: { k: 2 } });
  assert.deepEqual(evaluate({ current: { reguaHash: 'r1', debt: { k: 2 } }, record, recordValid: true, baseState: null }), { problems: [], resign: false });
});

test('régua alterada reprova com a mensagem de decisão humana', () => {
  const record = signed({ reguaHash: 'r1', debt: {} });
  const { problems } = evaluate({ current: { reguaHash: 'r2', debt: {} }, record, recordValid: true, baseState: null });
  assert.deepEqual(problems, [REGUA_CHANGED]);
  assert.match(REGUA_CHANGED, /mudança de régua é decisão humana: rode `quality-kit rules accept`/);
});

test('registro adulterado reprova', () => {
  const { problems } = evaluate({ current: { reguaHash: 'r1', debt: {} }, record: { reguaHash: 'r1', debt: {}, signature: 'x' }, recordValid: false, baseState: null });
  assert.match(problems[0], /adulterado/);
});

test('sem aceite nem base (régua nova): reprova como régua alterada', () => {
  assert.deepEqual(evaluate({ current: { reguaHash: 'r1', debt: {} }, record: null, recordValid: false, baseState: null }).problems, [REGUA_CHANGED]);
});

test('dívida que cresce reprova; que encolhe pede reassinatura', () => {
  const record = signed({ reguaHash: 'r1', debt: { 'eslint:a.ts regra': 2 } });
  const grown = evaluate({ current: { reguaHash: 'r1', debt: { 'eslint:a.ts regra': 3 } }, record, recordValid: true, baseState: null });
  assert.match(grown.problems[0], /eslint:a.ts regra {2}2 -> 3/);
  const shrunk = evaluate({ current: { reguaHash: 'r1', debt: { 'eslint:a.ts regra': 1 } }, record, recordValid: true, baseState: null });
  assert.deepEqual(shrunk, { problems: [], resign: true });
});

test('modo time: a régua da base vale sem aceite local, e o clone novo grava o aceite', () => {
  const baseState = { reguaHash: 'r1', debt: { k: 1 } };
  assert.deepEqual(evaluate({ current: { reguaHash: 'r1', debt: { k: 1 } }, record: null, recordValid: false, baseState }), { problems: [], resign: true });
  assert.deepEqual(evaluate({ current: { reguaHash: 'r9', debt: {} }, record: null, recordValid: false, baseState }).problems, [REGUA_CHANGED]);
});

test('checkDebt desligado ignora a dívida, mas não a régua', () => {
  const record = signed({ reguaHash: 'r1', debt: {} });
  assert.deepEqual(evaluate({ current: { reguaHash: 'r1', debt: { k: 9 } }, record, recordValid: true, baseState: null, checkDebt: false }).problems, []);
});

test('arquivo movido leva a própria dívida', () => {
  const renames = parseRenames('R100\tsrc/velho.ts\tsrc/novo.ts\nM\tsrc/x.ts');
  const formerKey = renamedKey(renames);
  assert.equal(formerKey('eslint:src/novo.ts max-lines'), 'eslint:src/velho.ts max-lines');
  assert.equal(formerKey('eslint:src/x.ts max-lines'), null);
  assert.deepEqual(debtGrowth({ 'eslint:src/velho.ts max-lines': 1 }, { 'eslint:src/novo.ts max-lines': 1 }, formerKey), []);
  assert.equal(debtGrowth({}, { 'eslint:src/novo.ts max-lines': 1 }).length, 1);
});

test('supressões do ESLint viram chaves planas', () => {
  assert.deepEqual(flattenSuppressions('eslint:apps/web/', { 'src/a.ts': { complexity: { count: 2 } } }), { 'eslint:apps/web/src/a.ts complexity': 2 });
});

test('rules accept só com humano num terminal', () => {
  const tty = { isTTY: true };
  assert.equal(humanAtTerminal({ env: {}, stdin: tty, stdout: tty }).ok, true);
  assert.equal(humanAtTerminal({ env: { CLAUDECODE: '1' }, stdin: tty, stdout: tty }).ok, false);
  assert.equal(humanAtTerminal({ env: { QUALITY_KIT_HOOK: '1' }, stdin: tty, stdout: tty }).ok, false);
  assert.equal(humanAtTerminal({ env: {}, stdin: {}, stdout: tty }).ok, false);
});
