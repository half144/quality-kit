import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluate, humanAtTerminal, isSigned, REGUA_CHANGED, sign } from '../src/integrity/integrity.mjs';
import { debtGrowth, flattenSuppressions, hashEntries, parseRenames, renamedKey } from '../src/integrity/ruleset.mjs';

const KEY = 'test-key';

function signed(state) {
  return { ...state, signature: sign(state, KEY) };
}

test('the ruleset hash does not depend on order and changes with content', () => {
  assert.equal(hashEntries([['a', '1'], ['b', '2']]), hashEntries([['b', '2'], ['a', '1']]));
  assert.notEqual(hashEntries([['a', '1']]), hashEntries([['a', '2']]));
});

test('the signature covers ruleset and debt', () => {
  const record = signed({ reguaHash: 'r1', debt: { 'eslint:a.ts x': 1 } });
  assert.ok(isSigned(record, KEY));
  assert.ok(!isSigned({ ...record, debt: { 'eslint:a.ts x': 5 } }, KEY));
  assert.ok(!isSigned({ ...record, reguaHash: 'r2' }, KEY));
  assert.ok(!isSigned(record, 'other-key'));
});

test('same ruleset and same debt as accepted: passed, no re-signing', () => {
  const record = signed({ reguaHash: 'r1', debt: { k: 2 } });
  assert.deepEqual(evaluate({ current: { reguaHash: 'r1', debt: { k: 2 } }, record, recordValid: true, baseState: null }), { problems: [], resign: false });
});

test('a changed ruleset fails with the human decision message', () => {
  const record = signed({ reguaHash: 'r1', debt: {} });
  const { problems } = evaluate({ current: { reguaHash: 'r2', debt: {} }, record, recordValid: true, baseState: null });
  assert.deepEqual(problems, [REGUA_CHANGED]);
  assert.match(REGUA_CHANGED, /ruleset changes are a human decision: run `quality-kit rules accept`/);
});

test('a tampered record fails', () => {
  const { problems } = evaluate({ current: { reguaHash: 'r1', debt: {} }, record: { reguaHash: 'r1', debt: {}, signature: 'x' }, recordValid: false, baseState: null });
  assert.match(problems[0], /tampered/);
});

test('no acceptance and no base (new ruleset): fails as a changed ruleset', () => {
  assert.deepEqual(evaluate({ current: { reguaHash: 'r1', debt: {} }, record: null, recordValid: false, baseState: null }).problems, [REGUA_CHANGED]);
});

test('growing debt fails; shrinking debt asks for re-signing', () => {
  const record = signed({ reguaHash: 'r1', debt: { 'eslint:a.ts regra': 2 } });
  const grown = evaluate({ current: { reguaHash: 'r1', debt: { 'eslint:a.ts regra': 3 } }, record, recordValid: true, baseState: null });
  assert.match(grown.problems[0], /eslint:a.ts regra {2}2 -> 3/);
  const shrunk = evaluate({ current: { reguaHash: 'r1', debt: { 'eslint:a.ts regra': 1 } }, record, recordValid: true, baseState: null });
  assert.deepEqual(shrunk, { problems: [], resign: true });
});

test('team mode: the base ruleset counts without local acceptance, and a fresh clone writes the acceptance', () => {
  const baseState = { reguaHash: 'r1', debt: { k: 1 } };
  assert.deepEqual(evaluate({ current: { reguaHash: 'r1', debt: { k: 1 } }, record: null, recordValid: false, baseState }), { problems: [], resign: true });
  assert.deepEqual(evaluate({ current: { reguaHash: 'r9', debt: {} }, record: null, recordValid: false, baseState }).problems, [REGUA_CHANGED]);
});

test('checkDebt off ignores the debt but not the ruleset', () => {
  const record = signed({ reguaHash: 'r1', debt: {} });
  assert.deepEqual(evaluate({ current: { reguaHash: 'r1', debt: { k: 9 } }, record, recordValid: true, baseState: null, checkDebt: false }).problems, []);
});

test('a moved file carries its own debt', () => {
  const renames = parseRenames('R100\tsrc/velho.ts\tsrc/novo.ts\nM\tsrc/x.ts');
  const formerKey = renamedKey(renames);
  assert.equal(formerKey('eslint:src/novo.ts max-lines'), 'eslint:src/velho.ts max-lines');
  assert.equal(formerKey('eslint:src/x.ts max-lines'), null);
  assert.deepEqual(debtGrowth({ 'eslint:src/velho.ts max-lines': 1 }, { 'eslint:src/novo.ts max-lines': 1 }, formerKey), []);
  assert.equal(debtGrowth({}, { 'eslint:src/novo.ts max-lines': 1 }).length, 1);
});

test('ESLint suppressions become flat keys', () => {
  assert.deepEqual(flattenSuppressions('eslint:apps/web/', { 'src/a.ts': { complexity: { count: 2 } } }), { 'eslint:apps/web/src/a.ts complexity': 2 });
});

test('rules accept only for a human at a terminal', () => {
  const tty = { isTTY: true };
  assert.equal(humanAtTerminal({ env: {}, stdin: tty, stdout: tty }).ok, true);
  assert.equal(humanAtTerminal({ env: { CLAUDECODE: '1' }, stdin: tty, stdout: tty }).ok, false);
  assert.equal(humanAtTerminal({ env: { QUALITY_KIT_HOOK: '1' }, stdin: tty, stdout: tty }).ok, false);
  assert.equal(humanAtTerminal({ env: {}, stdin: {}, stdout: tty }).ok, false);
});
