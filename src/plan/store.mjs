/** The tiny plan on disk: `plan.md` and `approval.json` in the branch folder. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readJson } from '../integrity/ruleset.mjs';
import { ensureDir } from '../project.mjs';
import { planErrors, planHash, planStatus } from './plan.mjs';

export function planPath(dir) {
  return join(dir, 'plan.md');
}

function approvalPath(dir) {
  return join(dir, 'approval.json');
}

export function readPlan(dir) {
  const text = existsSync(planPath(dir)) ? readFileSync(planPath(dir), 'utf8') : null;
  const approval = readJson(approvalPath(dir));
  return { text, approval, status: planStatus(text, approval) };
}

export function writePlan(dir, text) {
  const errors = planErrors(text);
  if (errors.length > 0) throw new Error(`Not a tiny plan:\n${errors.map((error) => `  ${error}`).join('\n')}`);
  ensureDir(dir);
  writeFileSync(planPath(dir), `${text.trim()}\n`);
  return readPlan(dir);
}

export function approvePlan(dir, now = new Date()) {
  const { text } = readPlan(dir);
  if (text === null) throw new Error('There is no tiny plan for this branch to approve: write it first (`quality-kit plan write`).');
  writeFileSync(approvalPath(dir), `${JSON.stringify({ approvedAt: now.toISOString(), hash: planHash(text) }, null, 2)}\n`);
  return readPlan(dir);
}
