/**
 * On-screen proof as the contract between `quality-kit verify` and the gate:
 * which screens the change requires opening, the fingerprint of the tree that
 * was opened and what the report is missing. The gate only reads: it never
 * opens a browser.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { docPath } from '../config.mjs';
import { git, listFiles } from '../git/git.mjs';
import { affectedScreens, isUiFile, targetsOf } from './affected.mjs';
import { normalizeApps, targetKey } from './apps.mjs';
import { mapGaps, parseFeatureMap } from './feature-map.mjs';
import { appImporters, owningImporters } from './import-graph.mjs';

export const VERIFY_COMMAND = 'quality-kit verify --changed';

export function reportPath(project) {
  return join(project.stateDir, 'verify', 'report.json');
}

export function loadScreens(project, config, apps) {
  const path = docPath(project, config, 'map');
  return existsSync(path) ? parseFeatureMap(readFileSync(path, 'utf8'), apps) : [];
}

/** `git write-tree` of the index plus the worktree, in a temporary index: the real index is left untouched. */
export function treeHash(repo) {
  const dir = mkdtempSync(join(tmpdir(), 'quality-kit-index-'));
  const index = join(dir, 'index');
  try {
    const current = resolve(repo, git(repo, 'rev-parse', '--git-path', 'index'));
    if (existsSync(current)) copyFileSync(current, index);
    const env = { ...process.env, GIT_INDEX_FILE: index };
    const withIndex = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    withIndex('add', '--all');
    return withIndex('write-tree');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function importersFinder(repo) {
  const graphs = new Map();
  return (app, path, isOwner) => {
    if (!graphs.has(app.name)) graphs.set(app.name, appImporters(repo, app.src, listFiles(repo)));
    return owningImporters(path, graphs.get(app.name), isOwner);
  };
}

export function changedTargets(project, config, files) {
  const apps = normalizeApps(config.verify);
  return targetsOf(affectedScreens(apps, loadScreens(project, config, apps), files, importersFinder(project.repo)));
}

/** Does the change touch a screen? If so, which targets the report must have passed. */
export function requiredProof(project, config, files) {
  const apps = normalizeApps(config.verify);
  if (!files.some((file) => isUiFile(apps, file))) return [];
  return changedTargets(project, config, files);
}

export function readReport(project) {
  const path = reportPath(project);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function passed(report, target) {
  const runs = report.results.filter((result) => result.app === target.app && result.path === target.path);
  return runs.length > 0 && runs.every((result) => result.ok);
}

function reportGap(apps, report, tree, targets) {
  if (!report) return 'There is no verify report for this state.';
  if (report.tree !== tree) return `The verify report is for a different state of the files (tree ${report.tree}, now ${tree}): something changed after verify ran.`;
  const missing = targets.filter((target) => !passed(report, target));
  if (missing.length === 0) return null;
  return `The verify report does not pass, on desktop and mobile: ${missing.map((target) => targetKey(apps, target)).join(', ')}.`;
}

/** The problem for the gate, or null when the proof is up to date. Pure. */
export function proofProblem({ apps, report, tree, targets }) {
  if (targets.length === 0) return null;
  const gap = reportGap(apps, report, tree, targets);
  if (!gap) return null;
  return [
    'On-screen proof: this change touches a screen, and a green build and tests do not prove it opens.',
    gap,
    `Affected screens (screen map): ${targets.map((target) => targetKey(apps, target)).join(', ')}.`,
    `Run \`${VERIFY_COMMAND}\` and fix whatever it fails. It opens each screen on desktop and mobile and writes the report; change a file afterwards and it has to run again.`,
  ].join('\n');
}

/** A new screen with no row in the map: without one, verify does not know how to open it. */
export function mapProblem(project, config, changed) {
  const apps = normalizeApps(config.verify);
  const { missing } = mapGaps(apps, loadScreens(project, config, apps), listFiles(project.repo));
  const touched = missing.filter((screen) => {
    const app = apps.find((entry) => entry.name === screen.app);
    return changed.includes(app.routesDir + screen.file);
  });
  if (touched.length === 0) return null;
  return `Screen with no row in the screen map (${docPath(project, config, 'map')}): ${touched.map((screen) => `${screen.app} ${screen.file}`).join(', ')}. Use the \`map\` skill to add the route and the demo path.`;
}

export function proofCheck(project, config, changed, readState = () => ({ report: readReport(project), tree: treeHash(project.repo) })) {
  const targets = requiredProof(project, config, changed);
  const map = mapProblem(project, config, changed);
  const proof = targets.length === 0 ? null : proofProblem({ apps: normalizeApps(config.verify), ...readState(), targets });
  return [map, proof].filter(Boolean).join('\n\n') || null;
}
