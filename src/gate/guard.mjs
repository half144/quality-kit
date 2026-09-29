/**
 * The PreToolUse hook: keeps out of the agent's reach anything that would
 * dismantle the integrity lock. The ruleset itself may be edited (the lock
 * fails until a human accepts it); what may not happen is forging the
 * acceptance: this machine's key, the acceptance records, the kit's code and
 * dependencies, `rules accept`, the baseline and the shortcuts that skip the
 * gate (`--no-verify`, `--suppress-all`).
 *
 * It is a barrier against shortcuts, not against whoever owns the terminal:
 * the machine owner can always disable the plugin.
 */

import { isAbsolute, join, resolve } from 'node:path';

import { loadConfig } from '../config.mjs';
import { keyPath } from '../integrity/integrity.mjs';
import { locateProject } from '../project.mjs';
import { KIT_ROOT, kitHome } from '../runtime.mjs';

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

const ALWAYS_FORBIDDEN = [
  [/\brules\s+accept\b/, '`quality-kit rules accept` is for humans only, at a terminal.'],
  [/QUALITY_KIT_HOME\s*=/, 'changing the kit home is forging the acceptance.'],
  [/\.quality-kit\/(key|accepted|runtime)/, 'the kit key and acceptances are off limits to the agent.'],
];

/** Only in projects where the kit is set up: elsewhere the plugin enforces nothing. */
const PROJECT_FORBIDDEN = [
  [/quality-kit(\.mjs)?\s+(baseline|finalize)\b/, 'freezing debt is a human decision.'],
  [/--suppress-(all|rule)\b/, 'bulk suppression hides new errors: fix the code.'],
  [/--no-verify\b/, 'skipping the git hooks is skipping the gate.'],
  [/core\.hooksPath/, 'the git hooks belong to the ruleset.'],
];

function protectedPaths() {
  return [keyPath(), join(kitHome(), 'accepted'), join(kitHome(), 'runtime'), KIT_ROOT];
}

function isInside(path, dir) {
  const target = resolve(path);
  return target === dir || target.startsWith(`${dir}/`);
}

/** The reason to block the call, or null. Pure, apart from reading the kit paths. */
export function guardReason(input, { paths = protectedPaths(), active = true } = {}) {
  const toolInput = input.tool_input ?? {};
  if (EDIT_TOOLS.has(input.tool_name)) {
    const raw = toolInput.file_path ?? toolInput.notebook_path;
    if (!raw) return null;
    const file = isAbsolute(raw) ? raw : resolve(input.cwd ?? process.cwd(), raw);
    return paths.some((dir) => isInside(file, dir)) ? `${file} is part of the quality-kit lock: the agent does not edit the kit, the key or the acceptances.` : null;
  }
  if (input.tool_name === 'Bash') {
    const rules = active ? [...ALWAYS_FORBIDDEN, ...PROJECT_FORBIDDEN] : ALWAYS_FORBIDDEN;
    const hit = rules.find(([pattern]) => pattern.test(toolInput.command ?? ''));
    return hit ? `Blocked by quality-kit: ${hit[1]}` : null;
  }
  return null;
}

function isActive(cwd) {
  try {
    const project = locateProject(cwd);
    return project.mode !== null && loadConfig(project.rulesDir).status === 'active';
  } catch {
    // Outside a git repository.
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
