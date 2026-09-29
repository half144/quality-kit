/**
 * `quality-kit verify`: on-screen proof. Starts each app with the ruleset's
 * command, opens each screen on desktop and mobile (iPhone 14) and fails on
 * console errors, exceptions, hydration errors, 4xx/5xx on the site's own
 * assets and screens with no text. Writes the report to the state folder
 * (inside `.git`), which the gate checks.
 *
 *   quality-kit verify /conta web:/painel
 *   quality-kit verify --changed
 *   quality-kit verify --all
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { baseRefs, branchChanges, mergeBase } from '../git/git.mjs';
import { ensureDir } from '../project.mjs';
import { loadDep } from '../runtime.mjs';
import { targetsOf } from './affected.mjs';
import { normalizeApps, parseTarget, targetKey } from './apps.mjs';
import { deviceProfiles, observe } from './browse.mjs';
import { evaluatePage } from './evaluate.mjs';
import { changedTargets, loadScreens, reportPath, treeHash } from './proof.mjs';
import { startApp } from './servers.mjs';

const FLAGS = new Set(['--changed', '--all']);

export function parseArgs(apps, argv) {
  const targets = argv.filter((arg) => !FLAGS.has(arg)).map((arg) => parseTarget(apps, arg));
  const flags = { changed: argv.includes('--changed'), all: argv.includes('--all') };
  if (!flags.changed && !flags.all && targets.length === 0) throw new Error('Usage: quality-kit verify <path>... | --changed | --all   (e.g. /conta web:/painel)');
  return { ...flags, targets };
}

export function screenshotName({ app, path, device }) {
  const slug = path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
  return `${app}-${slug}-${device}.png`;
}

/** Passes only if every screen passed and the tree did not change midway. */
export function buildReport({ tree, treeAfter, date, requested, results }) {
  const drifted = tree !== treeAfter;
  return {
    ok: !drifted && results.every((result) => result.ok),
    tree,
    date,
    requested,
    drift: drifted ? `The files changed while verify was running (tree ${tree} became ${treeAfter}): run it again.` : null,
    results,
  };
}

function unique(targets) {
  return [...new Map(targets.map((target) => [`${target.app} ${target.path}`, target])).values()];
}

function requestedTargets(project, config, apps, args) {
  const deduced = [];
  if (args.changed) deduced.push(...changedTargets(project, config, branchChanges(project.repo, mergeBase(project.repo, baseRefs(config.base))).changed));
  if (args.all) deduced.push(...targetsOf(loadScreens(project, config, apps)));
  return unique([...args.targets, ...deduced]);
}

async function checkTarget({ browser, servers, shots, apps, target }) {
  const app = apps.find((entry) => entry.name === target.app);
  return Promise.all(
    Object.entries(deviceProfiles()).map(async ([device, profile]) => {
      const screenshot = join(shots, screenshotName({ ...target, device }));
      const observation = await observe(browser, { app, origin: servers[target.app].origin, path: target.path, profile, screenshot });
      const problems = evaluatePage(observation);
      return { ...target, device, ok: problems.length === 0, problems, finalUrl: observation.finalUrl, screenshot };
    }),
  );
}

function printResult(apps, result) {
  process.stdout.write(`${result.ok ? 'ok    ' : 'FAILED'} ${targetKey(apps, result)} (${result.device})\n`);
  for (const { kind, detail } of result.problems) process.stdout.write(`    ${kind}: ${detail.split('\n')[0]}\n`);
}

async function runChecks(project, apps, dir, targets) {
  const servers = {};
  const { chromium } = loadDep('@playwright/test');
  const shots = ensureDir(join(dir, 'shots'));
  let browser = null;
  try {
    for (const name of new Set(targets.map((target) => target.app))) servers[name] = await startApp({ repo: project.repo, dir, app: apps.find((app) => app.name === name) });
    browser = await chromium.launch();
    const results = [];
    for (const target of targets) {
      const checked = await checkTarget({ browser, servers, shots, apps, target });
      checked.forEach((result) => printResult(apps, result));
      results.push(...checked);
    }
    return results;
  } finally {
    await browser?.close();
    Object.values(servers).forEach((server) => server.stop());
  }
}

export async function runVerify(project, config, argv) {
  const apps = normalizeApps(config.verify);
  if (apps.length === 0) throw new Error('The ruleset has no `verify.apps`: run the `setup` skill (or `map`) to say how to start the app.');
  const args = parseArgs(apps, argv);
  const tree = treeHash(project.repo);
  const targets = requestedTargets(project, config, apps, args);
  if (targets.length === 0) process.stdout.write('No screen that takes proof is affected by the change (screen map).\n');
  const path = reportPath(project);
  const dir = ensureDir(dirname(path));
  const results = targets.length === 0 ? [] : await runChecks(project, apps, dir, targets);
  const report = buildReport({ tree, treeAfter: treeHash(project.repo), date: new Date().toISOString(), requested: targets, results });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  if (report.drift) console.error(report.drift);
  process.stdout.write(`${report.ok ? 'Passed' : 'Failed'}: ${results.length} page loads across ${targets.length} screens. Report at ${path}, screenshots in ${join(dir, 'shots')}.\n`);
  return report.ok;
}
