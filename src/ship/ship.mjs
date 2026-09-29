/**
 * `quality-kit ship`: opens the PR with the tiny plan, the evidence and the
 * gate summary, or rewrites the branch's open PR. Refuses without an
 * approved plan, with changed screens and no fresh evidence, or with the gate
 * failing. Media goes up as GitHub attachments, never into the repo.
 *
 *   quality-kit ship [--dry-run] [--title <text>] [--base <branch>]
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { branchDir } from '../branch/state.mjs';
import { byFreshness, evidenceGap, readManifest } from '../evidence/manifest.mjs';
import { enabledChecks, runGate } from '../gate/gate.mjs';
import { baseRefs, branchChanges, mergeBase } from '../git/git.mjs';
import { planProblem } from '../plan/plan-check.mjs';
import { readPlan } from '../plan/store.mjs';
import { languageOf } from '../setup/language.mjs';
import { normalizeApps, targetKey } from '../verify/apps.mjs';
import { requiredProof, treeHash } from '../verify/proof.mjs';
import { prBody, prTitle } from './body.mjs';
import { githubToken, openPr, publishPr, pushBranch, repositoryId } from './github.mjs';
import { uploadAll } from './upload.mjs';

export const USAGE = 'Usage: quality-kit ship [--dry-run] [--title <text>] [--base <branch>]';

function option(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

/** Why the branch cannot ship; an empty list means it can. Pure. */
export function shipBlockers({ planStatus, gateProblems, evidence }) {
  const plan = planProblem(planStatus);
  const gate = gateProblems.length > 0 ? `The gate fails:\n\n${gateProblems.join('\n\n')}` : null;
  return [plan, evidence, gate].filter(Boolean);
}

/** `origin/main` -> `main`: the branch name gh expects. */
export function baseBranch(base) {
  return base.replace(/^origin\//, '');
}

/** What goes into the body for each fresh item: the framed still when there is one. */
export function mediaItems(fresh) {
  return fresh.map((item) => ({ kind: item.kind, screen: item.screen, device: item.device, caption: item.caption, path: item.framed ?? item.file }));
}

function evidenceState(project, config, branch) {
  const apps = normalizeApps(config.verify);
  const changed = branchChanges(project.repo, mergeBase(project.repo, baseRefs(config.base))).changed;
  const screens = requiredProof(project, config, changed).map((target) => targetKey(apps, target));
  const { fresh, stale } = byFreshness(readManifest(branch).items, treeHash(project.repo));
  return { fresh, gap: evidenceGap({ screens, fresh, stale }) };
}

async function publish(project, items) {
  const options = { repositoryId: repositoryId(project.repo), token: githubToken(project.repo) };
  return uploadAll(items, options);
}

export async function runShip(project, config, argv) {
  const dryRun = argv.includes('--dry-run');
  const branch = branchDir(project);
  const plan = readPlan(branch);
  const { fresh, gap } = evidenceState(project, config, branch);
  const gateProblems = await runGate({ project, config, profile: 'full' });
  const blockers = shipBlockers({ planStatus: plan.status, gateProblems, evidence: gap });
  if (blockers.length > 0) {
    console.error(`quality-kit ship refused:\n\n${blockers.join('\n\n')}`);
    return 1;
  }
  const items = mediaItems(fresh);
  const { uploaded, failures } = dryRun ? { uploaded: items, failures: [] } : await publish(project, items);
  const body = prBody({ language: languageOf(config), plan: plan.text, evidence: uploaded, checks: [...enabledChecks(config, 'full')] });
  const title = option(argv, '--title') ?? prTitle(plan.text);
  if (dryRun) {
    process.stdout.write(`Title: ${title}\n\n${body}\n`);
    return 0;
  }
  const bodyFile = join(branch, 'pr-body.md');
  writeFileSync(bodyFile, `${body}\n`);
  pushBranch(project.repo);
  const url = openPr(project.repo);
  const published = publishPr(project.repo, { url, title, bodyFile, base: option(argv, '--base') ?? baseBranch(config.base) });
  process.stdout.write(`${published}${url ? ' (updated)' : ''}\n`);
  if (failures.length > 0) console.error(`Some media did not upload (${failures.join('; ')}): the PR lists their local paths. Tell the owner.`);
  return 0;
}
