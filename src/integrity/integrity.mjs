/**
 * The integrity lock. The gate stores, signed with a key from this machine,
 * the ruleset hash and the frozen debt a human accepted. A ruleset different
 * from the accepted one fails; debt larger than the accepted one fails. Only
 * `quality-kit rules accept`, at a real terminal and outside an agent, signs a
 * new state.
 *
 * In team mode the base ruleset also counts (the one already reviewed at
 * merge): a fresh clone needs no acceptance for the ruleset that came from main.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ensureDir } from '../project.mjs';
import { kitHome } from '../runtime.mjs';
import { debtGrowth } from './ruleset.mjs';

export function keyPath() {
  return join(kitHome(), 'key');
}

export function machineKey() {
  const path = keyPath();
  if (!existsSync(path)) {
    ensureDir(kitHome());
    writeFileSync(path, randomBytes(32).toString('hex'), { mode: 0o600 });
    chmodSync(path, 0o600);
  }
  return readFileSync(path, 'utf8').trim();
}

export function recordPath(id) {
  return join(kitHome(), 'accepted', `${id}.json`);
}

function payload({ reguaHash, debt }) {
  return JSON.stringify({ reguaHash, debt: Object.fromEntries(Object.entries(debt).sort(([a], [b]) => a.localeCompare(b))) });
}

export function sign(state, key) {
  return createHmac('sha256', key).update(payload(state)).digest('hex');
}

export function isSigned(record, key) {
  if (!record?.signature) return false;
  const expected = Buffer.from(sign(record, key));
  const actual = Buffer.from(record.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function writeRecord(id, state, key = machineKey(), now = new Date()) {
  const record = { reguaHash: state.reguaHash, debt: state.debt, files: state.files ?? {}, acceptedAt: now.toISOString() };
  ensureDir(join(kitHome(), 'accepted'));
  writeFileSync(recordPath(id), `${JSON.stringify({ ...record, signature: sign(record, key) }, null, 2)}\n`);
}

export function readRecord(id) {
  const path = recordPath(id);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

export const REGUA_CHANGED =
  'The ruleset was changed; ruleset changes are a human decision: run `quality-kit rules accept` at a terminal (the agent cannot). If it was not you, revert the change.';

/**
 * Compares the current state with the trusted states (the signed acceptance
 * and, in team mode, the base one). Pure: returns the problems and whether the
 * acceptance should be rewritten (the debt shrank, or the clone had none yet).
 */
export function evaluate({ current, record, recordValid, baseState, formerKey, checkDebt = true }) {
  const trusted = [recordValid ? record : null, baseState].filter(Boolean);
  if (record && !recordValid) return { problems: ['The ruleset acceptance record was tampered with (signature mismatch). ' + REGUA_CHANGED], resign: false };
  if (trusted.length === 0) return { problems: [REGUA_CHANGED], resign: false };
  const sameRegua = trusted.filter((state) => state.reguaHash === current.reguaHash);
  if (sameRegua.length === 0) return { problems: [REGUA_CHANGED], resign: false };
  const growths = sameRegua.map((state) => (checkDebt ? debtGrowth(state.debt, current.debt, formerKey) : []));
  const clean = growths.find((growth) => growth.length === 0);
  if (!clean) return { problems: [debtMessage(growths[0])], resign: false };
  const debtShrank = !recordValid || debtGrowth(current.debt, record.debt).length > 0;
  return { problems: [], resign: debtShrank };
}

function debtMessage(growth) {
  const listed = growth.slice(0, 20).map(({ key, before, after }) => `  ${key}  ${before} -> ${after}`);
  return [
    'The frozen debt grew (a lint suppression or type error the baseline did not have):',
    ...listed,
    'Fix the code instead of suppressing: the baseline only holds the debt from when the ruleset was adopted, and it can only shrink.',
  ].join('\n');
}

const AGENT_ENV = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CODEX_SANDBOX', 'CODEX_SANDBOX_NETWORK_DISABLED', 'CODEX_THREAD_ID', 'QUALITY_KIT_HOOK'];

/** Is the caller a human at a terminal? Agents and hooks have no TTY and do not pass here. */
export function humanAtTerminal({ env = process.env, stdin = process.stdin, stdout = process.stdout } = {}) {
  const agent = AGENT_ENV.find((name) => env[name]);
  if (agent) return { ok: false, reason: `running inside an agent or hook (${agent} is set)` };
  if (!stdin.isTTY || !stdout.isTTY) return { ok: false, reason: 'no interactive terminal (stdin/stdout are not a TTY)' };
  return { ok: true, reason: null };
}
