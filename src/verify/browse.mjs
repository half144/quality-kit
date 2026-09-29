/**
 * Opens a screen in Playwright's Chromium, waits for it to settle and collects
 * what fails it (`evaluate.mjs`): console errors, exceptions, error responses
 * and the visible text. Takes a screenshot for anyone who wants to look.
 */

import { loadDep } from '../runtime.mjs';

const NAVIGATION_TIMEOUT_MS = 45_000;
const SETTLE_TIMEOUT_MS = 10_000;
const MAX_SETTLES = 4;

/** iPhone 14 on Chromium: Playwright's WebKit is a separate download. */
function iphone(devices) {
  const { viewport, screen, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 14'];
  return { viewport, screen, userAgent, deviceScaleFactor, isMobile, hasTouch };
}

export function deviceProfiles(devices = loadDep('@playwright/test').devices) {
  return { desktop: { viewport: { width: 1440, height: 900 } }, mobile: iphone(devices) };
}

/** The initial browser state the app asks for (e.g. onboarding already done). */
export function contextOptions(profile, app, origin) {
  const localStorage = app.localStorage ?? [];
  const storageState = localStorage.length > 0 ? { cookies: [], origins: [{ origin, localStorage }] } : undefined;
  return { ...profile, storageState };
}

async function settle(page) {
  for (let round = 0; round < MAX_SETTLES; round += 1) {
    const before = page.url();
    await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS }).catch(() => undefined);
    await page.waitForTimeout(1000);
    if (page.url() === before) return;
  }
}

function listen(page) {
  const seen = { consoleErrors: [], pageErrors: [], responses: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') seen.consoleErrors.push({ text: message.text(), url: message.location().url });
  });
  page.on('pageerror', (error) => seen.pageErrors.push(error.stack ?? error.message));
  page.on('response', (response) => seen.responses.push({ url: response.url(), status: response.status() }));
  return seen;
}

export async function observe(browser, { app, origin, path, profile, screenshot }) {
  const context = await browser.newContext(contextOptions(profile, app, origin));
  for (const blocked of app.blockPaths ?? []) await context.route(`${origin}${blocked}**`, (route) => route.abort('blockedbyclient'));
  const page = await context.newPage();
  const seen = listen(page);
  try {
    await page.goto(origin + path, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS });
    await settle(page);
    await page.screenshot({ path: screenshot, fullPage: false });
    const text = await page.locator('body').innerText();
    return { origin, ...seen, text, finalUrl: page.url(), navigationError: null };
  } catch (error) {
    return { origin, ...seen, text: '', finalUrl: page.url(), navigationError: error instanceof Error ? error.message : String(error) };
  } finally {
    await context.close();
  }
}
