/**
 * Video evidence, only for an interaction: the agent writes a cutaway plan and
 * the kit records it with the PR settings. A plan `url` may be a screen path
 * (`/conta`, `web:/painel`): the kit then starts the app (or uses `--origin`)
 * and records a resolved copy of the plan.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { ensureDir } from '../project.mjs';
import { parseTarget, targetKey } from '../verify/apps.mjs';
import { cutaway, cutawayDoctor, recordArgs } from './cutaway.mjs';
import { withServers } from './servers.mjs';

const ABSOLUTE_URL = /^(https?|file):/;

/** The screen the plan opens, and the app to start (null for an absolute URL). */
export function planTarget(apps, url) {
  if (ABSOLUTE_URL.test(url)) return { app: null, screen: new URL(url).pathname };
  const target = parseTarget(apps, url);
  return { app: target.app, path: target.path, screen: targetKey(apps, target) };
}

function absoluteFiles(file, planDir) {
  const files = Array.isArray(file) ? file : [file];
  const resolved = files.map((path) => (isAbsolute(path) ? path : resolve(planDir, path)));
  return Array.isArray(file) ? resolved : resolved[0];
}

/** The plan with the app's origin and absolute upload paths, so it can live anywhere. Pure. */
export function resolvePlan(plan, { origin, path, planDir }) {
  return {
    ...plan,
    url: origin ? origin + path : plan.url,
    steps: plan.steps.map((step) => (step.file === undefined ? step : { ...step, file: absoluteFiles(step.file, planDir) })),
  };
}

function slugOf(screen) {
  return screen.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
}

export async function recordVideo({ project, apps, dir, planFile, origin, tree }) {
  const problem = await cutawayDoctor();
  if (problem) throw new Error(problem);
  const plan = JSON.parse(readFileSync(planFile, 'utf8'));
  const target = planTarget(apps, plan.url);
  const device = plan.device ? 'phone' : 'desktop';
  const out = join(ensureDir(join(dir, 'videos')), `${slugOf(target.screen)}-${device}-${Date.now()}`);
  const names = target.app ? [target.app] : [];
  return withServers({ project, apps, dir, names, origin }, async (servers) => {
    const resolved = resolvePlan(plan, { origin: target.app && servers[target.app].origin, path: target.path, planDir: dirname(resolve(planFile)) });
    const planPath = join(ensureDir(out), 'plan.json');
    writeFileSync(planPath, `${JSON.stringify(resolved, null, 2)}\n`);
    const result = await cutaway(recordArgs({ plan: planPath, out: join(out, 'recording'), device }));
    process.stdout.write(`video ${target.screen} (${device}): ${result.output}\n`);
    return { kind: 'video', screen: target.screen, device, file: result.output, framed: null, caption: null, tree, capturedAt: new Date().toISOString() };
  });
}
