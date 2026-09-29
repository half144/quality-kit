/**
 * cutaway, the recorder and framer behind the evidence, pinned in the kit's
 * dependencies. Its CLI is called directly (`src/cli.mjs`): the auto-update
 * lives only in its skill wrapper, so the version stays the one the kit pins.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { run } from '../gate/run.mjs';
import { depsRoot, MissingDepsError } from '../runtime.mjs';

/** PR settings: legible in GitHub's player and ~30 s under the 10 MB attachment limit. */
export const VIDEO_SIZES = { desktop: ['--width', '1280', '--height', '720'], phone: ['--width', '720', '--height', '1280'] };

export const PHONE = 'iPhone 15 Pro';

export function cutawayCli(root = depsRoot()) {
  const cli = root && join(root, 'node_modules', 'cutaway', 'src', 'cli.mjs');
  if (!cli || !existsSync(cli)) throw new MissingDepsError();
  return cli;
}

export function recordArgs({ plan, out, device }) {
  return ['record', plan, '--out', out, ...VIDEO_SIZES[device], '--quality', 'standard'];
}

export function frameArgs({ input, output, url, device }) {
  return ['frame', input, '--output', output, ...(device === 'phone' ? ['--device', PHONE] : ['--url', url])];
}

/** What the doctor report says is missing, in the kit's terms, or null when ready. Pure. */
export function doctorProblem(report) {
  const failed = report.checks.filter((check) => !check.ok);
  if (failed.length === 0) return null;
  return failed
    .map((check) => {
      if (check.name === 'ffmpeg') return 'Video export needs FFmpeg with libx264: run `quality-kit install` again (it downloads one), or put one on PATH (`brew install ffmpeg`, `apt install ffmpeg`).';
      if (check.name === 'chromium') return 'Chromium for Playwright is missing: run `quality-kit install`.';
      return `cutaway ${check.name}: ${check.error}. Run \`quality-kit install\`.`;
    })
    .join('\n');
}

/** Runs the pinned cutaway; the result is the JSON it prints on stdout. */
export async function cutaway(args) {
  const result = await run(process.execPath, [cutawayCli(), ...args]);
  const parsed = parseJson(result.stdout);
  if (result.status !== 0 && !parsed?.checks) throw new Error(`cutaway ${args[0]} failed:\n${result.output.trim()}`);
  return parsed;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function cutawayDoctor() {
  return doctorProblem(await cutaway(['doctor']));
}
