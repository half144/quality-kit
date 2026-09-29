/**
 * O hook Stop/SubagentStop/SubagentStart do Claude Code. O plugin é instalado
 * na máquina, então o hook dispara em todo projeto: onde o kit não foi montado
 * (ou o setup não terminou) ele não faz nada.
 *
 * Reprovado, sai com código 2 e o relatório no stderr: o Claude Code não deixa
 * o agente parar e devolve o relatório para ele corrigir. Não há saída por
 * `stop_hook_active`: tentar parar de novo sem corrigir é bloqueado de novo, e
 * o próprio Claude Code encerra depois de vários bloqueios seguidos.
 *
 * Subagente que não mexeu em nada não responde pela área: o SubagentStart
 * guarda o estado e o SubagentStop só cobra se ele mudou.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadConfig } from '../config.mjs';
import { baseRefs, branchChanges, mergeBase } from '../git/git.mjs';
import { currentState } from '../integrity/state.mjs';
import { ensureDir, locateProject } from '../project.mjs';
import { report, runGate } from './gate.mjs';

function markPath(project, agentId) {
  return join(project.stateDir, 'agents', String(agentId).replace(/[^\w-]/g, '_'));
}

function snapshot(project, config) {
  const changes = branchChanges(project.repo, mergeBase(project.repo, baseRefs(config.base)));
  return `${changes.fingerprint}:${currentState(project, config).reguaHash}`;
}

function subagentUntouched(project, config, agentId) {
  const mark = markPath(project, agentId);
  if (!existsSync(mark)) return false;
  const before = readFileSync(mark, 'utf8');
  rmSync(mark);
  return before === snapshot(project, config);
}

function activeProject(cwd) {
  try {
    const project = locateProject(cwd);
    if (!project.mode) return null;
    const config = loadConfig(project.rulesDir);
    return config.status === 'active' ? { project, config } : null;
  } catch {
    // Fora de um repositório git: nada a cobrar.
    return null;
  }
}

/** Processa o evento; devolve a mensagem de bloqueio ou null. */
export async function handleHook(input) {
  process.env.QUALITY_KIT_HOOK = '1';
  const found = activeProject(input.cwd ?? process.cwd());
  if (!found) return null;
  const { project, config } = found;
  if (input.hook_event_name === 'SubagentStart') {
    ensureDir(join(project.stateDir, 'agents'));
    writeFileSync(markPath(project, input.agent_id), snapshot(project, config));
    return null;
  }
  if (input.hook_event_name === 'SubagentStop' && subagentUntouched(project, config, input.agent_id)) return null;
  const problems = await runGate({ project, config, profile: 'full' });
  return problems.length === 0 ? null : report(problems);
}

async function readStdin() {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

export async function hookMain() {
  const input = JSON.parse((await readStdin()) || '{}');
  try {
    const message = await handleHook(input);
    if (!message) return 0;
    console.error(message);
  } catch (error) {
    console.error(`quality-kit: o gate não conseguiu rodar: ${error instanceof Error ? error.message : error}`);
  }
  return 2;
}
