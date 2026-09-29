/**
 * A linha de comando do quality-kit. Um comando só para o gate (`gate`), que
 * o hook do Claude (`hook`), os hooks do git (`git-hook`) e o CI (`gate --ci`)
 * chamam; o resto monta a régua (`install`, `detect`, `init`, `finalize`),
 * prova a tela (`verify`) e cuida da trava (`rules accept`, só humano).
 */

import { readFileSync } from 'node:fs';

import { loadConfig } from './config.mjs';
import { report, runGate } from './gate/gate.mjs';
import { guardMain } from './gate/guard.mjs';
import { hookMain } from './gate/hook.mjs';
import { acceptRules, rebaseline, rulesStatus } from './integrity/accept.mjs';
import { locateProject } from './project.mjs';
import { installKit } from './setup/install.mjs';
import { detect } from './setup/detect.mjs';
import { finalizeProject, initProject } from './setup/init.mjs';
import { gitHook } from './setup/git-hook.mjs';
import { mapCommand } from './verify/map-command.mjs';
import { createSpaServer } from './verify/static-server.mjs';
import { runVerify } from './verify/verify.mjs';

const HELP = `quality-kit <comando>

  install                     instala as dependências do kit nesta máquina (uma vez)
  detect                      lê o projeto (stack, monorepo, forma do código) em JSON
  init --answers <arquivo>    grava os rascunhos da régua (a skill setup chama)
  finalize                    congela a dívida, instala os hooks e liga a régua
  gate [--profile full|fast] [--base <ref>] [--ci] [--allow-regua-change]
  verify <caminho>... | --changed | --all
  map [--write]               confere o mapa de telas contra as rotas do código
  serve <pasta> --port <n>    serve um export estático como SPA (para o verify)
  paths                       onde moram a régua e o estado deste projeto
  rules status                a régua de agora bate com a aceita?
  rules accept                aceita a régua de agora (só humano, num terminal)
  baseline                    congela a dívida de novo (só humano, num terminal)
  hook | guard | git-hook     entradas dos hooks (Claude Code e git)`;

function option(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

function activeProject() {
  const project = locateProject(process.cwd());
  if (!project.mode) throw new Error('O quality-kit não está montado neste projeto: rode a skill `setup`.');
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
    process.stdout.write('quality-kit: aprovado.\n');
    return 0;
  }
  console.error(report(problems));
  return 1;
}

/** Fica no ar até o verify matar o processo. */
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
  map: (argv) => mapCommand(activeProject(), argv),
  paths: () => print(locateProject(process.cwd())),
  serve: (argv) => serveSpa(argv[0], Number(option(argv, '--port'))),
  rules: (argv) => {
    if (argv[0] === 'accept') return acceptRules();
    if (argv[0] === 'status') return rulesStatus();
    return print('Uso: quality-kit rules accept | rules status');
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
