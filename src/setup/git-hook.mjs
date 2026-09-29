/** `quality-kit git-hook <pre-commit|pre-push>`: the gate with the profile the ruleset picked for each hook. */

import { loadConfig } from '../config.mjs';
import { report, runGate } from '../gate/gate.mjs';
import { locateProject } from '../project.mjs';

const PROFILE_KEY = { 'pre-commit': 'preCommit', 'pre-push': 'prePush' };

async function readStdin() {
  if (process.stdin.isTTY) return '';
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

/** Does the push go straight to a protected branch? `lines` is the pre-push stdin. */
export function protectedPush(lines, branches) {
  return lines
    .split('\n')
    .map((line) => line.split(' ')[2])
    .find((ref) => branches.some((branch) => ref === `refs/heads/${branch}`)) ?? null;
}

export async function gitHook(name) {
  const project = locateProject(process.cwd());
  if (!project.mode) return 0;
  const config = loadConfig(project.rulesDir);
  const profile = config.hooks[PROFILE_KEY[name]];
  if (config.status !== 'active' || !profile || profile === 'off') return 0;
  if (name === 'pre-push' && config.hooks.protectBranches?.length) {
    const ref = protectedPush(await readStdin(), config.hooks.protectBranches);
    if (ref) {
      console.error(`Direct push to ${ref} blocked: create a branch and open a PR.`);
      return 1;
    }
  }
  const problems = await runGate({ project, config, profile });
  if (problems.length === 0) return 0;
  console.error(report(problems));
  return 1;
}
