/**
 * A prova na tela como contrato entre o `quality-kit verify` e o gate: quais
 * telas a mudança obriga a abrir, a impressão digital da árvore que foi aberta
 * e o que falta no relatório. O gate só lê: nunca abre navegador.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { git, listFiles } from '../git/git.mjs';
import { affectedScreens, isUiFile, targetsOf } from './affected.mjs';
import { normalizeApps, targetKey } from './apps.mjs';
import { mapGaps, parseFeatureMap } from './feature-map.mjs';
import { appImporters, owningImporters } from './import-graph.mjs';

export const VERIFY_COMMAND = 'quality-kit verify --changed';

export function reportPath(project) {
  return join(project.stateDir, 'verify', 'report.json');
}

export function mapPath(project) {
  return join(project.rulesDir, 'FEATURE_MAP.md');
}

export function loadScreens(project, apps) {
  const path = mapPath(project);
  return existsSync(path) ? parseFeatureMap(readFileSync(path, 'utf8'), apps) : [];
}

/** O `git write-tree` do índice mais a worktree, num índice temporário: o índice de verdade não muda. */
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
  return targetsOf(affectedScreens(apps, loadScreens(project, apps), files, importersFinder(project.repo)));
}

/** A mudança mexe em tela? Se sim, que alvos o relatório precisa ter aprovados. */
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
  if (!report) return 'Não há relatório do verify para este estado.';
  if (report.tree !== tree) return `O relatório do verify é de outro estado dos arquivos (árvore ${report.tree}, agora ${tree}): algo mudou depois do verify.`;
  const missing = targets.filter((target) => !passed(report, target));
  if (missing.length === 0) return null;
  return `O relatório do verify não aprova, em desktop e celular: ${missing.map((target) => targetKey(apps, target)).join(', ')}.`;
}

/** O problema para o gate, ou null quando a prova está em dia. Puro. */
export function proofProblem({ apps, report, tree, targets }) {
  if (targets.length === 0) return null;
  const gap = reportGap(apps, report, tree, targets);
  if (!gap) return null;
  return [
    'Prova na tela: esta mudança mexe em tela, e build e teste verdes não provam que ela abre.',
    gap,
    `Telas afetadas (mapa de telas): ${targets.map((target) => targetKey(apps, target)).join(', ')}.`,
    `Rode \`${VERIFY_COMMAND}\` e corrija o que ele reprovar. Ele abre cada tela em desktop e celular e grava o relatório; mude um arquivo depois e ele precisa rodar de novo.`,
  ].join('\n');
}

/** Tela nova sem linha no mapa: sem ela, o verify não sabe abrir. */
export function mapProblem(project, config, changed) {
  const apps = normalizeApps(config.verify);
  const { missing } = mapGaps(apps, loadScreens(project, apps), listFiles(project.repo));
  const touched = missing.filter((screen) => {
    const app = apps.find((entry) => entry.name === screen.app);
    return changed.includes(app.routesDir + screen.file);
  });
  if (touched.length === 0) return null;
  return `Tela sem linha no mapa de telas (${mapPath(project)}): ${touched.map((screen) => `${screen.app} ${screen.file}`).join(', ')}. Use a skill \`map\` para acrescentar a rota e o caminho de demonstração.`;
}

export function proofCheck(project, config, changed, readState = () => ({ report: readReport(project), tree: treeHash(project.repo) })) {
  const targets = requiredProof(project, config, changed);
  const map = mapProblem(project, config, changed);
  const proof = targets.length === 0 ? null : proofProblem({ apps: normalizeApps(config.verify), ...readState(), targets });
  return [map, proof].filter(Boolean).join('\n\n') || null;
}
