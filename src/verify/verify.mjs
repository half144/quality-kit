/**
 * `quality-kit verify`: prova na tela. Sobe cada app com o comando da régua,
 * abre cada tela em desktop e celular (iPhone 14) e reprova erro de console,
 * exceção, erro de hidratação, 4xx/5xx de asset próprio e tela sem texto.
 * Grava o relatório na pasta de estado (dentro de `.git`), que o gate confere.
 *
 *   quality-kit verify /conta web:/painel
 *   quality-kit verify --changed
 *   quality-kit verify --all
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { baseRefs, branchChanges, mergeBase } from '../git/git.mjs';
import { ensureDir } from '../project.mjs';
import { loadDep } from '../runtime.mjs';
import { targetsOf } from './affected.mjs';
import { normalizeApps, parseTarget, targetKey } from './apps.mjs';
import { deviceProfiles, observe } from './browse.mjs';
import { evaluatePage } from './evaluate.mjs';
import { changedTargets, loadScreens, reportPath, treeHash } from './proof.mjs';
import { startApp } from './servers.mjs';

const FLAGS = new Set(['--changed', '--all']);

export function parseArgs(apps, argv) {
  const targets = argv.filter((arg) => !FLAGS.has(arg)).map((arg) => parseTarget(apps, arg));
  const flags = { changed: argv.includes('--changed'), all: argv.includes('--all') };
  if (!flags.changed && !flags.all && targets.length === 0) throw new Error('Uso: quality-kit verify <caminho>... | --changed | --all   (ex.: /conta web:/painel)');
  return { ...flags, targets };
}

export function screenshotName({ app, path, device }) {
  const slug = path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'raiz';
  return `${app}-${slug}-${device}.png`;
}

/** Aprovado só se toda tela passou e a árvore não mudou no meio. */
export function buildReport({ tree, treeAfter, date, requested, results }) {
  const drifted = tree !== treeAfter;
  return {
    ok: !drifted && results.every((result) => result.ok),
    tree,
    date,
    requested,
    drift: drifted ? `Os arquivos mudaram durante o verify (árvore ${tree} virou ${treeAfter}): rode de novo.` : null,
    results,
  };
}

function unique(targets) {
  return [...new Map(targets.map((target) => [`${target.app} ${target.path}`, target])).values()];
}

function requestedTargets(project, config, apps, args) {
  const deduced = [];
  if (args.changed) deduced.push(...changedTargets(project, config, branchChanges(project.repo, mergeBase(project.repo, baseRefs(config.base))).changed));
  if (args.all) deduced.push(...targetsOf(loadScreens(project, apps)));
  return unique([...args.targets, ...deduced]);
}

async function checkTarget({ browser, servers, shots, apps, target }) {
  const app = apps.find((entry) => entry.name === target.app);
  return Promise.all(
    Object.entries(deviceProfiles()).map(async ([device, profile]) => {
      const screenshot = join(shots, screenshotName({ ...target, device }));
      const observation = await observe(browser, { app, origin: servers[target.app].origin, path: target.path, profile, screenshot });
      const problems = evaluatePage(observation);
      return { ...target, device, ok: problems.length === 0, problems, finalUrl: observation.finalUrl, screenshot };
    }),
  );
}

function printResult(apps, result) {
  process.stdout.write(`${result.ok ? 'ok ' : 'FALHOU'} ${targetKey(apps, result)} (${result.device})\n`);
  for (const { kind, detail } of result.problems) process.stdout.write(`    ${kind}: ${detail.split('\n')[0]}\n`);
}

async function runChecks(project, apps, dir, targets) {
  const servers = {};
  const { chromium } = loadDep('@playwright/test');
  const shots = ensureDir(join(dir, 'shots'));
  let browser = null;
  try {
    for (const name of new Set(targets.map((target) => target.app))) servers[name] = await startApp({ repo: project.repo, dir, app: apps.find((app) => app.name === name) });
    browser = await chromium.launch();
    const results = [];
    for (const target of targets) {
      const checked = await checkTarget({ browser, servers, shots, apps, target });
      checked.forEach((result) => printResult(apps, result));
      results.push(...checked);
    }
    return results;
  } finally {
    await browser?.close();
    Object.values(servers).forEach((server) => server.stop());
  }
}

export async function runVerify(project, config, argv) {
  const apps = normalizeApps(config.verify);
  if (apps.length === 0) throw new Error('A régua não tem `verify.apps`: rode a skill `setup` (ou `map`) para dizer como subir o app.');
  const args = parseArgs(apps, argv);
  const tree = treeHash(project.repo);
  const targets = requestedTargets(project, config, apps, args);
  if (targets.length === 0) process.stdout.write('Nenhuma tela com prova afetada pela mudança (mapa de telas).\n');
  const path = reportPath(project);
  const dir = ensureDir(dirname(path));
  const results = targets.length === 0 ? [] : await runChecks(project, apps, dir, targets);
  const report = buildReport({ tree, treeAfter: treeHash(project.repo), date: new Date().toISOString(), requested: targets, results });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  if (report.drift) console.error(report.drift);
  process.stdout.write(`${report.ok ? 'Aprovado' : 'Reprovado'}: ${results.length} aberturas em ${targets.length} telas. Relatório em ${path}, capturas em ${join(dir, 'shots')}.\n`);
  return report.ok;
}
