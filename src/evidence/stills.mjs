/**
 * Still evidence: each screen on desktop and phone, marked if asked, then
 * framed by cutaway (a browser window, or the drawn iPhone). The sizes are the
 * ones cutaway frames pixel for pixel: 1440x810 at 2x, and the iPhone 15 Pro
 * page at 3x.
 */

import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { ensureDir } from '../project.mjs';
import { loadDep } from '../runtime.mjs';
import { targetKey } from '../verify/apps.mjs';
import { contextOptions, settle } from '../verify/browse.mjs';
import { screenshotName } from '../verify/verify.mjs';
import { cutaway, frameArgs, PHONE } from './cutaway.mjs';
import { markElement } from './mark.mjs';
import { withServers } from './servers.mjs';

const NAVIGATION_TIMEOUT_MS = 45_000;

/** cutaway lays the phone page out between the status bar (54 px) and the home indicator (34 px). */
const IPHONE_BARS = 54 + 34;

export function stillProfiles(devices) {
  const { screen, userAgent } = devices[PHONE];
  return {
    desktop: { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2 },
    phone: { viewport: { width: screen.width, height: screen.height - IPHONE_BARS }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent },
  };
}

async function screenshot(browser, { app, origin, path, profile, file, mark }) {
  const context = await browser.newContext(contextOptions(profile, app, origin));
  for (const blocked of app.blockPaths ?? []) await context.route(`${origin}${blocked}**`, (route) => route.abort('blockedbyclient'));
  const page = await context.newPage();
  try {
    await page.goto(origin + path, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS });
    await settle(page);
    const failure = mark ? await page.evaluate(markElement, mark) : null;
    if (failure) throw new Error(`--mark on ${path}: ${failure}.`);
    await page.screenshot({ path: file });
  } finally {
    await context.close();
  }
}

/** A marked still gets its own file: the same screen may carry two different marks. */
export function stillName(target, device, mark) {
  const name = screenshotName({ ...target, device });
  if (!mark) return name;
  return name.replace(/\.png$/, `-${createHash('sha256').update(`${mark.selector}\0${mark.caption}`).digest('hex').slice(0, 6)}.png`);
}

async function captureTarget({ browser, apps, servers, shots, target, mark, tree }) {
  const app = apps.find((entry) => entry.name === target.app);
  const origin = servers[target.app].origin;
  const items = [];
  for (const [device, profile] of Object.entries(stillProfiles(loadDep('@playwright/test').devices))) {
    const file = join(shots, stillName(target, device, mark));
    await screenshot(browser, { app, origin, path: target.path, profile, file, mark });
    const { output: framed } = await cutaway(frameArgs({ input: file, output: file.replace(/\.png$/, '.framed.png'), url: origin + target.path, device }));
    items.push({ kind: 'still', screen: targetKey(apps, target), device, file, framed, caption: mark?.caption ?? null, tree, capturedAt: new Date().toISOString() });
    process.stdout.write(`still ${targetKey(apps, target)} (${device}): ${framed}\n`);
  }
  return items;
}

export async function captureStills({ project, apps, dir, targets, origin, mark, tree }) {
  const shots = ensureDir(join(dir, 'stills'));
  const names = [...new Set(targets.map((target) => target.app))];
  return withServers({ project, apps, dir, names, origin }, async (servers) => {
    const browser = await loadDep('@playwright/test').chromium.launch();
    try {
      const items = [];
      for (const target of targets) items.push(...(await captureTarget({ browser, apps, servers, shots, target, mark, tree })));
      return items;
    } finally {
      await browser.close();
    }
  });
}
