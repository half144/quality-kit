/**
 * The Claude Code Stop/SubagentStop/SubagentStart hook. The plugin is installed
 * per machine, so the hook fires in every project: where the kit is not set up
 * (or setup has not finished) it does nothing.
 *
 * On failure it exits with code 2 and the report on stderr: Claude Code keeps
 * the agent from stopping and hands it the report to fix. There is no escape
 * via `stop_hook_active`: trying to stop again without fixing is blocked again,
 * and Claude Code itself ends the session after several blocks in a row.
 *
 * A subagent that changed nothing is not held responsible for the area:
 * SubagentStart records the state and SubagentStop only enforces if it changed.
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
    // Outside a git repository: nothing to enforce.
    return null;
  }
}

/** Handles the event; returns the blocking message or null. */
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
    console.error(`quality-kit: the gate could not run: ${error instanceof Error ? error.message : error}`);
  }
  return 2;
}
