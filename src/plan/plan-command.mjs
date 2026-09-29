/**
 * `quality-kit plan`: the tiny plan of the current branch.
 *
 *   quality-kit plan write [--file <plan.md>]   (stdin without --file)
 *   quality-kit plan show | status
 *   quality-kit plan approve                    (only after the owner's ok in chat)
 */

import { readFileSync } from 'node:fs';

import { branchDir } from '../branch/state.mjs';
import { loadConfig } from '../config.mjs';
import { changesFingerprint } from './plan-check.mjs';
import { TEMPLATE } from './plan.mjs';
import { approvePlan, planPath, readPlan, writePlan } from './store.mjs';

export const USAGE = `Usage: quality-kit plan write [--file <plan.md>] | show | status | approve\n\nTemplate:\n${TEMPLATE}`;

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

const ACTIONS = {
  write: async (project, argv) => {
    const { text, status } = writePlan(branchDir(project), await planText(argv), changesNow(project));
    const next = status === 'approved' ? 'Unchanged: it stays approved.' : 'Show this plan to the owner as it is and STOP until they give an explicit ok; only then run `quality-kit plan approve`.';
    return out(`${text}\nSaved at ${planPath(branchDir(project))} (${status}). ${next}`);
  },
  show: (project) => {
    const { text, status } = readPlan(branchDir(project));
    return out(text === null ? 'No tiny plan for this branch.' : `${text}\n(${status})`);
  },
  status: (project) => out(readPlan(branchDir(project)).status),
  approve: (project) => out(`Approved at ${approvePlan(branchDir(project)).approval.approvedAt}. Editing the plan now takes the approval away.`),
};

export async function planCommand(project, argv) {
  const action = ACTIONS[argv[0]];
  if (!action) return out(USAGE);
  return action(project, argv.slice(1));
}
