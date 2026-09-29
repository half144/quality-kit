/**
 * A trava de integridade. O gate guarda, assinado com uma chave desta máquina,
 * o hash da régua e a dívida congelada que um humano aceitou. Régua diferente
 * da aceita reprova; dívida maior que a aceita reprova. Só `quality-kit rules
 * accept`, num terminal de verdade e fora de agente, assina um estado novo.
 *
 * No modo time vale também a régua da base (a que já passou por revisão no
 * merge): um clone novo não precisa de aceite para a régua que veio da main.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ensureDir } from '../project.mjs';
import { kitHome } from '../runtime.mjs';
import { debtGrowth } from './regua.mjs';

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
  'A régua foi alterada; mudança de régua é decisão humana: rode `quality-kit rules accept` num terminal (o agente não pode). Se não foi você, desfaça a alteração.';

/**
 * Compara o estado de agora com os estados confiáveis (o aceite assinado e,
 * no modo time, o da base). Puro: devolve os problemas e se o aceite deve ser
 * regravado (a dívida encolheu, ou o clone ainda não tinha aceite).
 */
export function evaluate({ current, record, recordValid, baseState, formerKey, checkDebt = true }) {
  const trusted = [recordValid ? record : null, baseState].filter(Boolean);
  if (record && !recordValid) return { problems: ['O registro de aceite da régua foi adulterado (assinatura não confere). ' + REGUA_CHANGED], resign: false };
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
    'A dívida congelada cresceu (supressão de lint ou erro de tipo que a baseline não tinha):',
    ...listed,
    'Conserte o código em vez de suprimir: a baseline só guarda a dívida de quando a régua entrou e só pode encolher.',
  ].join('\n');
}

const AGENT_ENV = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CODEX_SANDBOX', 'CODEX_SANDBOX_NETWORK_DISABLED', 'CODEX_THREAD_ID', 'QUALITY_KIT_HOOK'];

/** Quem chama é um humano num terminal? Agente e hook não têm TTY nem passam aqui. */
export function humanAtTerminal({ env = process.env, stdin = process.stdin, stdout = process.stdout } = {}) {
  const agent = AGENT_ENV.find((name) => env[name]);
  if (agent) return { ok: false, reason: `rodando dentro de um agente ou hook (${agent} definido)` };
  if (!stdin.isTTY || !stdout.isTTY) return { ok: false, reason: 'sem terminal interativo (stdin/stdout não são TTY)' };
  return { ok: true, reason: null };
}
