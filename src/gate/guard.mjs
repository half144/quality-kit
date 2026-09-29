/**
 * O hook PreToolUse: tira do alcance do agente o que desmontaria a trava de
 * integridade. A régua em si pode ser editada (a trava reprova até um humano
 * aceitar); o que não pode é forjar o aceite: a chave desta máquina, os
 * registros de aceite, o código e as dependências do kit, `rules accept`, a
 * baseline e os atalhos que pulam o gate (`--no-verify`, `--suppress-all`).
 *
 * É uma barreira contra o atalho, não contra quem tem o terminal: o dono da
 * máquina sempre pode desligar o plugin.
 */

import { isAbsolute, join, resolve } from 'node:path';

import { loadConfig } from '../config.mjs';
import { keyPath } from '../integrity/integrity.mjs';
import { locateProject } from '../project.mjs';
import { KIT_ROOT, kitHome } from '../runtime.mjs';

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

const ALWAYS_FORBIDDEN = [
  [/\brules\s+accept\b/, '`quality-kit rules accept` é só para humano, num terminal.'],
  [/QUALITY_KIT_HOME\s*=/, 'trocar a casa do kit é forjar o aceite.'],
  [/\.quality-kit\/(key|accepted|runtime)/, 'a chave e os aceites do kit não são do agente.'],
];

/** Só nos projetos com o kit montado: fora deles o plugin não cobra nada. */
const PROJECT_FORBIDDEN = [
  [/quality-kit(\.mjs)?\s+(baseline|finalize)\b/, 'congelar a dívida é decisão humana.'],
  [/--suppress-(all|rule)\b/, 'suprimir em massa esconde erro novo: conserte o código.'],
  [/--no-verify\b/, 'pular os hooks do git é pular o gate.'],
  [/core\.hooksPath/, 'os hooks do git são da régua.'],
];

function protectedPaths() {
  return [keyPath(), join(kitHome(), 'accepted'), join(kitHome(), 'runtime'), KIT_ROOT];
}

function isInside(path, dir) {
  const target = resolve(path);
  return target === dir || target.startsWith(`${dir}/`);
}

/** O motivo de bloquear a chamada, ou null. Puro, fora a leitura dos caminhos do kit. */
export function guardReason(input, { paths = protectedPaths(), active = true } = {}) {
  const toolInput = input.tool_input ?? {};
  if (EDIT_TOOLS.has(input.tool_name)) {
    const raw = toolInput.file_path ?? toolInput.notebook_path;
    if (!raw) return null;
    const file = isAbsolute(raw) ? raw : resolve(input.cwd ?? process.cwd(), raw);
    return paths.some((dir) => isInside(file, dir)) ? `${file} é parte da trava do quality-kit: o agente não edita o kit, a chave nem os aceites.` : null;
  }
  if (input.tool_name === 'Bash') {
    const rules = active ? [...ALWAYS_FORBIDDEN, ...PROJECT_FORBIDDEN] : ALWAYS_FORBIDDEN;
    const hit = rules.find(([pattern]) => pattern.test(toolInput.command ?? ''));
    return hit ? `Bloqueado pelo quality-kit: ${hit[1]}` : null;
  }
  return null;
}

function isActive(cwd) {
  try {
    const project = locateProject(cwd);
    return project.mode !== null && loadConfig(project.rulesDir).status === 'active';
  } catch {
    // Fora de um repositório git.
    return false;
  }
}

async function readStdin() {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

export async function guardMain() {
  const input = JSON.parse((await readStdin()) || '{}');
  const reason = guardReason(input, { active: isActive(input.cwd ?? process.cwd()) });
  if (!reason) return 0;
  console.error(reason);
  return 2;
}
