/**
 * The tiny plan on disk, in the branch folder: `plan.md`, `approval.json` and
 * `written.json` (the branch's change fingerprint when the plan was saved).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readJson } from '../integrity/ruleset.mjs';
import { ensureDir } from '../project.mjs';
import { planErrors } from './limits.mjs';
import { planHash, planStatus } from './plan.mjs';

export function planPath(dir) {
  return join(dir, 'plan.md');
}

function approvalPath(dir) {
  return join(dir, 'approval.json');
}

function writtenPath(dir) {
  return join(dir, 'written.json');
}

export function readPlan(dir) {
  const text = existsSync(planPath(dir)) ? readFileSync(planPath(dir), 'utf8') : null;
  const approval = readJson(approvalPath(dir));
  const written = readJson(writtenPath(dir));
  return { text, approval, written, status: planStatus(text, approval) };
}

/** `changes`: the branch's change fingerprint now, so the Stop hook knows no code moved while the plan waits for the ok. */
export function writePlan(dir, text, changes = null) {
  const errors = planErrors(text);
  if (errors.length > 0) throw new Error(`Not a tiny plan:\n${errors.map((error) => `  ${error}`).join('\n')}\nFix what is listed and run \`quality-kit plan write\` again.`);
  ensureDir(dir);
  writeFileSync(planPath(dir), `${text.trim()}\n`);
  writeFileSync(writtenPath(dir), `${JSON.stringify({ changes }, null, 2)}\n`);
  return readPlan(dir);
}

export function approvePlan(dir, now = new Date()) {
  const { text } = readPlan(dir);
  if (text === null) throw new Error('There is no tiny plan for this branch to approve: write it first (`quality-kit plan write`).');
  writeFileSync(approvalPath(dir), `${JSON.stringify({ approvedAt: now.toISOString(), hash: planHash(text) }, null, 2)}\n`);
  return readPlan(dir);
}
