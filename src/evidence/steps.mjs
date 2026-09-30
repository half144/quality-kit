/**
 * A still plan: the steps that bring a screen to the state worth showing (a
 * code gate, a login, an open tab) before the screenshot. The steps are the
 * ones a cutaway video plan has, with the same names and fields, so an agent
 * that writes one writes both; they run in plain Playwright, without the
 * recorder's pacing, on both still profiles.
 */

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 120_000;

/** Each action, and the field it cannot do without. */
const ACTIONS = {
  click: 'selector',
  tap: 'selector',
  type: 'selector',
  focus: 'selector',
  upload: 'selector',
  press: 'key',
  scroll: 'y',
  swipe: 'y',
  wait: 'duration',
};

/** Desktop clicks and scrolls, the phone taps and swipes: the author may write either. */
const ON_DEVICE = {
  desktop: { tap: 'click', swipe: 'scroll' },
  phone: { click: 'tap', scroll: 'swipe' },
};

function stepProblem(step) {
  if (!step || typeof step !== 'object' || !(step.action in ACTIONS)) return `unsupported action; use one of ${Object.keys(ACTIONS).join(', ')}.`;
  const field = ACTIONS[step.action];
  if (field === 'selector' && (typeof step.selector !== 'string' || !step.selector)) return 'selector is required (a Playwright locator).';
  if (step.action === 'type' && typeof step.text !== 'string') return 'text must be a string.';
  if (field === 'key' && typeof step.key !== 'string') return 'key must be a string (e.g. "Enter").';
  if (field === 'y' && !Number.isFinite(step.y)) return 'y must be a number of pixels.';
  if (field === 'duration' && !(Number.isFinite(step.duration) && step.duration >= 0 && step.duration <= 60)) return 'duration must be 0 to 60 seconds.';
  if (step.action === 'upload' && ![step.file].flat().every((file) => typeof file === 'string' && file)) return 'file must be a path or a non-empty array of paths.';
  if (step.expect !== undefined && (typeof step.expect !== 'string' || !step.expect)) return 'expect must be a non-empty selector.';
  return null;
}

function markOf(mark) {
  if (mark === undefined) return null;
  if (typeof mark?.selector !== 'string' || !mark.selector) throw new Error('Still plan: mark needs a selector (a CSS selector), with optional actual and expected.');
  return { selector: mark.selector, actual: mark.actual, expected: mark.expected };
}

/**
 * The plan checked, with upload paths made absolute. Video-only fields of a
 * cutaway plan (`device`, `pause`, `hold`) are ignored: a still is taken on
 * desktop and phone. Pure.
 */
export function validateStillPlan(plan, planDir) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new Error('Still plan: the file must be a JSON object with url and steps.');
  if (typeof plan.url !== 'string' || !plan.url) throw new Error('Still plan: url is required, a screen path (/conta, admin:/users) or a full URL.');
  if (!Array.isArray(plan.steps)) throw new Error('Still plan: steps must be an array (the clicks and typing before the shot).');
  if (plan.timeout !== undefined && !(Number.isInteger(plan.timeout) && plan.timeout >= 1 && plan.timeout <= MAX_TIMEOUT_MS)) {
    throw new Error(`Still plan: timeout must be an integer from 1 to ${MAX_TIMEOUT_MS} milliseconds.`);
  }
  plan.steps.forEach((step, index) => {
    const problem = stepProblem(step);
    if (problem) throw new Error(`Still plan, step ${index + 1}: ${problem}`);
  });
  const absolute = (file) => (isAbsolute(file) ? file : resolve(planDir, file));
  return {
    url: plan.url,
    steps: plan.steps.map((step) => (step.action === 'upload' ? { ...step, file: [step.file].flat().map(absolute) } : step)),
    mark: markOf(plan.mark),
    timeout: plan.timeout ?? DEFAULT_TIMEOUT_MS,
  };
}

export function readStillPlan(file) {
  let plan;
  try {
    plan = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Still plan ${file}: ${error.message}`);
  }
  return validateStillPlan(plan, dirname(resolve(file)));
}

/** The steps as the device performs them. Pure. */
export function stepsOn(steps, device) {
  const aliases = ON_DEVICE[device];
  return steps.map((step) => (aliases[step.action] ? { ...step, action: aliases[step.action] } : step));
}

async function upload(page, locator, files) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), locator.click()]);
  await chooser.setFiles(files);
}

async function swipe(page, y) {
  const { width, height } = page.viewportSize();
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, y);
}

const PERFORM = {
  click: (page, step) => page.locator(step.selector).click(),
  tap: (page, step) => page.locator(step.selector).tap(),
  type: (page, step) => page.locator(step.selector).fill(step.text),
  focus: (page, step) => page.locator(step.selector).scrollIntoViewIfNeeded(),
  upload: (page, step) => upload(page, page.locator(step.selector), step.file),
  press: (page, step) => page.keyboard.press(step.key),
  scroll: (page, step) => swipe(page, step.y),
  swipe: (page, step) => swipe(page, step.y),
  wait: (page, step) => page.waitForTimeout(step.duration * 1000),
};

function describe(step) {
  return [step.action, step.selector ?? step.key ?? step.y ?? step.duration].filter((part) => part !== undefined).join(' ');
}

/** Runs the steps on the page; a failure names the step, so the plan can be fixed. */
export async function runSteps(page, steps, timeout) {
  page.setDefaultTimeout(timeout);
  for (const [index, step] of steps.entries()) {
    try {
      await PERFORM[step.action](page, step);
      if (step.expect) await page.locator(step.expect).waitFor({ state: 'visible' });
    } catch (error) {
      throw new Error(`Still plan, step ${index + 1} (${describe(step)}): ${error.message.split('\n')[0]}`);
    }
  }
}
