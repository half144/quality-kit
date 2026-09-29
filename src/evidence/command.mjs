/**
 * `quality-kit evidence`: the PR-facing proof of the current branch (verify is
 * the runtime smoke proof the gate reads; evidence is what the reviewer sees).
 *
 *   quality-kit evidence still <path>... | --changed [--origin <url>]
 *                              [--mark <css> [--actual <text>] [--expected <text>]]
 *   quality-kit evidence record <cutaway-plan.json> [--origin <url>]
 *   quality-kit evidence status | clear | doctor
 */

import { rmSync } from 'node:fs';

import { branchDir } from '../branch/state.mjs';
import { baseRefs, branchChanges, mergeBase } from '../git/git.mjs';
import { languageOf } from '../setup/language.mjs';
import { normalizeApps, parseTarget } from '../verify/apps.mjs';
import { changedTargets, treeHash } from '../verify/proof.mjs';
import { cutawayDoctor } from './cutaway.mjs';
import { byFreshness, evidenceDir, readManifest, withItems, writeManifest } from './manifest.mjs';
import { captionText } from './mark.mjs';
import { recordVideo } from './record.mjs';
import { captureStills } from './stills.mjs';

const VALUE_FLAGS = new Set(['--origin', '--mark', '--actual', '--expected']);

const USAGE = `Usage:
  quality-kit evidence still <path>... | --changed [--origin <url>] [--mark <css> [--actual <text>] [--expected <text>]]
  quality-kit evidence record <cutaway-plan.json> [--origin <url>]
  quality-kit evidence status | clear | doctor`;

/** Flags with a value, the rest as positionals. Pure. */
export function parseFlags(argv) {
  const values = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (VALUE_FLAGS.has(arg)) {
      values[arg.slice(2)] = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--')) values[arg.slice(2)] = true;
    else positionals.push(arg);
  }
  return { values, positionals };
}

export function stillOptions(apps, argv, language) {
  const { values, positionals } = parseFlags(argv);
  if (!values.changed && positionals.length === 0) throw new Error(USAGE);
  if ((values.actual || values.expected) && !values.mark) throw new Error('--actual and --expected caption a --mark: say which element (a CSS selector).');
  const caption = captionText(language, values);
  return {
    targets: positionals.map((arg) => parseTarget(apps, arg)),
    changed: values.changed === true,
    origin: values.origin ?? null,
    mark: values.mark ? { selector: values.mark, caption: caption || null } : null,
  };
}

function unique(targets) {
  return [...new Map(targets.map((target) => [`${target.app} ${target.path}`, target])).values()];
}

function record(branch, items) {
  writeManifest(branch, withItems(readManifest(branch), items));
  process.stdout.write(`Evidence manifest updated (${items.length} item(s)) in ${evidenceDir(branch)}.\n`);
  return 0;
}

function describe(item, fresh) {
  return `${fresh ? 'fresh' : 'STALE'}  ${item.kind} ${item.screen} (${item.device})${item.caption ? ` "${item.caption}"` : ''}\n       ${item.framed ?? item.file}`;
}

const ACTIONS = {
  still: async ({ project, config, apps, branch }, argv) => {
    const options = stillOptions(apps, argv, languageOf(config));
    const changed = options.changed ? changedTargets(project, config, branchChanges(project.repo, mergeBase(project.repo, baseRefs(config.base))).changed) : [];
    const targets = unique([...options.targets, ...changed]);
    if (targets.length === 0) throw new Error('No screen to capture: the change affects no screen in the map. Name the screen path.');
    const items = await captureStills({ project, apps, dir: evidenceDir(branch), targets, origin: options.origin, mark: options.mark, tree: treeHash(project.repo) });
    return record(branch, items);
  },
  record: async ({ project, apps, branch }, argv) => {
    const { values, positionals } = parseFlags(argv);
    if (positionals.length !== 1) throw new Error(USAGE);
    const item = await recordVideo({ project, apps, dir: evidenceDir(branch), planFile: positionals[0], origin: values.origin ?? null, tree: treeHash(project.repo) });
    return record(branch, [item]);
  },
  status: ({ project, branch }) => {
    const { items } = readManifest(branch);
    const { fresh } = byFreshness(items, treeHash(project.repo));
    const lines = items.map((item) => describe(item, fresh.includes(item)));
    process.stdout.write(`${lines.length === 0 ? 'No evidence for this branch.' : lines.join('\n')}\n`);
    return 0;
  },
  clear: ({ branch }) => {
    rmSync(evidenceDir(branch), { recursive: true, force: true });
    process.stdout.write('Evidence cleared for this branch.\n');
    return 0;
  },
  doctor: async () => {
    const problem = await cutawayDoctor();
    process.stdout.write(`${problem ?? 'cutaway is ready: screenshots, framing and video.'}\n`);
    return problem ? 1 : 0;
  },
};

export async function evidenceCommand({ project, config }, argv) {
  const action = ACTIONS[argv[0]];
  if (!action) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const apps = normalizeApps(config.verify);
  return action({ project, config, apps, branch: branchDir(project) }, argv.slice(1));
}
