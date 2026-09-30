/**
 * `quality-kit plan`: the tiny plan of the current branch.
 *
 *   quality-kit plan write [--file <plan.md>]   (stdin without --file)
 *   quality-kit plan show | status
 *   quality-kit plan approve                    (only after the owner's ok in chat)
 *
 * `write` and `show` print the plan as markdown, the same rendering the PR
 * body uses, for the agent to paste in chat as it is.
 */

import { readFileSync } from 'node:fs';

import { branchDir } from '../branch/state.mjs';
import { loadConfig } from '../config.mjs';
import { LIMITS } from './limits.mjs';
import { changesFingerprint } from './plan-check.mjs';
import { TEMPLATE } from './plan.mjs';
import { renderPlan } from './render.mjs';
import { approvePlan, planPath, readPlan, writePlan } from './store.mjs';

const LIMITS_TEXT = `Limits: at most ${LIMITS.lines} lines and ${LIMITS.lineChars} characters per line; Where is ${LIMITS.whereBullets.min} to ${LIMITS.whereBullets.max} bullets; Context at most ${LIMITS.contextSentences} sentences.`;

export const USAGE = `Usage: quality-kit plan write [--file <plan.md>] | show | status | approve\n\nTemplate:\n${TEMPLATE}\n\n${LIMITS_TEXT}`;

async function readStdin() {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

async function planText(argv) {
  const index = argv.indexOf('--file');
  return index === -1 ? readStdin() : readFileSync(argv[index + 1], 'utf8');
}

function out(text) {
  process.stdout.write(`${text}\n`);
  return 0;
}

/** Where the kit is not set up there is no base to compare against, and no Stop hook to tell. */
function changesNow(project) {
  return project.mode ? changesFingerprint(project, loadConfig(project.rulesDir)) : null;
}

const TO_PASTE = 'Paste the plan above into your message exactly as printed: markdown, not inside a code block, with at most one short line before it.';

const ACTIONS = {
  write: async (project, argv) => {
    const { text, status } = writePlan(branchDir(project), await planText(argv), changesNow(project));
    const next = status === 'approved' ? 'Unchanged: it stays approved.' : `${TO_PASTE} Then STOP until the owner gives an explicit ok; only then run \`quality-kit plan approve\`.`;
    return out(`${renderPlan(text)}\n\n(saved at ${planPath(branchDir(project))}, ${status}) ${next}`);
  },
  show: (project) => {
    const { text, status } = readPlan(branchDir(project));
    return out(text === null ? 'No tiny plan for this branch.' : `${renderPlan(text)}\n\n(${status})`);
  },
  status: (project) => out(readPlan(branchDir(project)).status),
  approve: (project) => out(`Approved at ${approvePlan(branchDir(project)).approval.approvedAt}. Editing the plan now takes the approval away.`),
};

export async function planCommand(project, argv) {
  const action = ACTIONS[argv[0]];
  if (!action) return out(USAGE);
  return action(project, argv.slice(1));
}
