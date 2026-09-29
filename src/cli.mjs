/**
 * The quality-kit command line. A single command for the gate (`gate`), which
 * the Claude hook (`hook`), the git hooks (`git-hook`) and CI (`gate --ci`)
 * call; the rest builds the ruleset (`install`, `detect`, `init`, `finalize`),
 * proves the screen (`verify`), carries the delivery (`plan`, `evidence`,
 * `ship`) and manages the lock (`rules accept`, humans only).
 */

import { readFileSync } from 'node:fs';

import { branchDir } from './branch/state.mjs';
import { loadConfig } from './config.mjs';
import { evidenceCommand } from './evidence/command.mjs';
import { report, runGate } from './gate/gate.mjs';
import { guardMain } from './gate/guard.mjs';
import { hookMain } from './gate/hook.mjs';
import { acceptRules, rebaseline, rulesStatus } from './integrity/accept.mjs';
import { planCommand } from './plan/plan-command.mjs';
import { locateProject } from './project.mjs';
import { installKit } from './setup/install.mjs';
import { detect } from './setup/detect.mjs';
import { finalizeProject, initProject } from './setup/init.mjs';
import { gitHook } from './setup/git-hook.mjs';
import { runShip } from './ship/ship.mjs';
import { mapCommand } from './verify/map-command.mjs';
import { createSpaServer } from './verify/static-server.mjs';
import { runVerify } from './verify/verify.mjs';

const HELP = `quality-kit <command>

  install                     installs the kit dependencies on this machine (once)
  detect                      reads the project (stack, monorepo, code shape) as JSON
  init --answers <file>       writes the ruleset drafts (called by the setup skill)
  finalize                    freezes the debt, installs the hooks and enables the ruleset
  gate [--profile full|fast] [--base <ref>] [--ci] [--allow-regua-change]
  verify <path>... | --changed | --all
  plan write|show|approve     the branch's tiny plan (approve only after the owner's ok in chat)
  evidence still|record ...   screenshots, framing and video for the PR (also status, clear, doctor)
  ship [--dry-run]            opens the PR with the plan, the evidence and the gate summary
  map [--write]               checks the screen map against the code routes
  serve <folder> --port <n>   serves a static export as an SPA (for verify)
  paths                       where this project's ruleset and state live
  rules status                does the current ruleset match the accepted one?
  rules accept                accepts the current ruleset (humans only, at a terminal)
  baseline                    freezes the debt again (humans only, at a terminal)
  hook | guard | git-hook     hook entry points (Claude Code and git)`;

function option(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

function activeProject() {
  const project = locateProject(process.cwd());
  if (!project.mode) throw new Error('quality-kit is not set up in this project: run the `setup` skill.');
  return { project, config: loadConfig(project.rulesDir) };
}

async function gateCommand(argv) {
  const { project, config } = activeProject();
  const problems = await runGate({
    project,
    config,
    profile: option(argv, '--profile') ?? 'full',
    base: option(argv, '--base'),
    ci: argv.includes('--ci'),
    allowReguaChange: argv.includes('--allow-regua-change'),
  });
  if (problems.length === 0) {
    process.stdout.write('quality-kit: passed.\n');
    return 0;
  }
  console.error(report(problems));
  return 1;
}

/** Stays up until verify kills the process. */
function serveSpa(dir, port) {
  return new Promise(() => {
    createSpaServer(dir).listen(port, '127.0.0.1');
  });
}

function print(value) {
  process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
  return 0;
}

const COMMANDS = {
  install: () => installKit(),
  detect: () => print(detect(locateProject(process.cwd()).repo)),
  init: (argv) => print(initProject(process.cwd(), JSON.parse(readFileSync(option(argv, '--answers'), 'utf8'))).rulesDir),
  finalize: async () => {
    const result = await finalizeProject(process.cwd());
    return print({ rulesDir: result.project.rulesDir, mode: result.project.mode, debtTotals: result.debtTotals, lint: result.debt.lint, types: result.debt.types, hooks: result.hooks, teamFiles: result.teamFiles, notes: result.notes });
  },
  gate: gateCommand,
  hook: () => hookMain(),
  guard: () => guardMain(),
  'git-hook': (argv) => gitHook(argv[0]),
  verify: async (argv) => {
    const { project, config } = activeProject();
    return (await runVerify(project, config, argv)) ? 0 : 1;
  },
  plan: (argv) => planCommand(locateProject(process.cwd()), argv),
  evidence: (argv) => evidenceCommand(activeProject(), argv),
  ship: (argv) => {
    const { project, config } = activeProject();
    return runShip(project, config, argv);
  },
  map: (argv) => mapCommand(activeProject(), argv),
  paths: () => {
    const project = locateProject(process.cwd());
    return print({ ...project, branchDir: branchDir(project) });
  },
  serve: (argv) => serveSpa(argv[0], Number(option(argv, '--port'))),
  rules: (argv) => {
    if (argv[0] === 'accept') return acceptRules();
    if (argv[0] === 'status') return rulesStatus();
    return print('Usage: quality-kit rules accept | rules status');
  },
  baseline: () => rebaseline(),
};

export async function main(argv) {
  const [name, ...rest] = argv;
  const command = COMMANDS[name];
  if (!command) return print(HELP);
  try {
    return await command(rest);
  } catch (error) {
    console.error(`quality-kit: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}
