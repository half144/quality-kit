/**
 * A config do ESLint que o gate usa no modo `kit`: a config do próprio projeto
 * (se houver) com o preset do kit e as regras extras da régua por cima. É
 * gerada a cada execução na pasta de estado (dentro de `.git`), então o repo
 * não muda.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { slug } from '../config.mjs';
import { ensureDir } from '../project.mjs';
import { listFiles } from '../git/git.mjs';
import { depsRoot, KIT_ROOT, loadDep, MissingDepsError } from '../runtime.mjs';

const CONFIG_NAMES = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'];
export const DEFAULT_IGNORES = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/out/**', '**/coverage/**', '**/*.d.ts', '**/_generated/**'];

/** A config flat do projeto para o workspace: a dele ou a da raiz. */
export function findProjectConfig(repo, workspaceDir, exists = existsSync) {
  const dirs = [...new Set([join(repo, workspaceDir), repo])];
  for (const dir of dirs) {
    const found = CONFIG_NAMES.map((name) => join(dir, name)).find(exists);
    if (found) return found;
  }
  return null;
}

/** O texto do módulo de config. Puro, para dar para testar sem ESLint. */
export function overlaySource({ deps, presetPath, projectConfig, extraRules, tsconfigRootDir, tsconfigs = [], untyped = [], ignores }) {
  const json = JSON.stringify;
  const projectLine = projectConfig
    ? `[(await import(${json(pathToFileURL(projectConfig).href)})).default].flat(Infinity)`
    : `[js.configs.recommended, ...tseslint.configs.recommended, { languageOptions: { globals: { ...globals.browser, ...globals.node } } }]`;
  const extraLine = extraRules ? `kitRequire(${json(extraRules)})` : '{}';
  return `// Gerado pelo quality-kit a cada execução do gate. Não edite: a régua mora na pasta do projeto no kit.
import { createRequire } from 'node:module';

const kitRequire = createRequire(${json(join(deps, 'package.json'))});
const { buildQuality, warningsAsErrors } = kitRequire(${json(presetPath)});
const js = kitRequire('@eslint/js');
const tseslint = kitRequire('typescript-eslint');
const globals = kitRequire('globals');
const sonarjs = kitRequire('eslint-plugin-sonarjs');
const comments = kitRequire('@eslint-community/eslint-plugin-eslint-comments');

const project = ${projectLine};
const extra = ${extraLine};
const registered = (name) => project.find((config) => config?.plugins?.[name])?.plugins[name];
const parser = project.find((config) => config?.languageOptions?.parser)?.languageOptions.parser ?? tseslint.parser;

export default warningsAsErrors([
  { ignores: ${json(ignores)} },
  ...project,
  { files: ['**/*.jsx'], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } },
  ...buildQuality({
    plugins: {
      sonarjs: registered('sonarjs') ?? sonarjs,
      comments: registered('@eslint-community/eslint-comments') ?? comments,
      typescript: registered('@typescript-eslint') ?? tseslint.plugin,
      parser,
    },
    tsconfigRootDir: ${json(tsconfigRootDir)},
    tsconfigs: ${json(tsconfigs)},
    untyped: ${json(untyped)},
    restrictedSyntax: extra.restrictedSyntax ?? [],
  }),
  ...[extra.configs ?? []].flat(Infinity),
]);
`;
}

/**
 * As flags da régua (`--strict`, `--noUncheckedIndexedAccess`) como
 * compilerOptions. Flag seguida de valor (`--target es2022`) leva o valor.
 */
export function flagsToOptions(flags) {
  const options = {};
  for (let index = 0; index < flags.length; index += 1) {
    const name = flags[index].replace(/^--/, '');
    const next = flags[index + 1];
    const hasValue = next !== undefined && !next.startsWith('--');
    options[name] = hasValue ? next : true;
    if (hasValue) index += 1;
  }
  return options;
}

/**
 * Um tsconfig por tsconfig do workspace, que estende o do projeto e liga as
 * flags estritas: o lint com tipos enxerga o mesmo programa estrito do tsc,
 * sem mexer no tsconfig do repo. Fica na pasta de estado, dentro de `.git`.
 */
export function writeStrictTsconfigs({ project, config, workspace }) {
  const dir = ensureDir(join(project.stateDir, 'tsconfig'));
  return [workspace.tsconfig]
    .flat()
    .filter(Boolean)
    .map((tsconfig) => {
      const file = join(dir, `${slug(workspace.dir)}--${tsconfig.replace(/[/\\]/g, '__')}`);
      const content = { extends: join(project.repo, workspace.dir, tsconfig), compilerOptions: flagsToOptions(config.typescript.flags) };
      writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`);
      return file;
    });
}

/**
 * Os arquivos TS do workspace que nenhum tsconfig inclui (config de
 * ferramenta, script solto): sem programa, o lint com tipos não tem como
 * rodar neles, então eles levam só as regras sem tipo.
 */
export function untypedFiles(workspaceFiles, covered) {
  return workspaceFiles.filter((file) => /\.[cm]?tsx?$/.test(file) && !file.endsWith('.d.ts') && !covered.has(file));
}

function coveredFiles(tsconfigs, root) {
  const ts = loadDep('typescript');
  const host = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined };
  const covered = new Set();
  for (const tsconfig of tsconfigs) {
    for (const file of ts.getParsedCommandLineOfConfigFile(tsconfig, {}, host)?.fileNames ?? []) covered.add(relative(root, file).split('\\').join('/'));
  }
  return covered;
}

/** Grava a config do workspace e devolve o caminho dela. */
export function writeOverlay({ project, config, workspace }) {
  const deps = depsRoot();
  if (!deps) throw new MissingDepsError();
  const extraPath = join(project.rulesDir, config.lint.extraRules);
  const root = join(project.repo, workspace.dir);
  const tsconfigs = writeStrictTsconfigs({ project, config, workspace });
  const workspaceFiles = listFiles(project.repo).filter((file) => file.startsWith(workspace.dir)).map((file) => file.slice(workspace.dir.length));
  const source = overlaySource({
    deps,
    presetPath: join(KIT_ROOT, 'src', 'lint', 'preset.cjs'),
    projectConfig: config.lint.projectConfig === false ? null : findProjectConfig(project.repo, workspace.dir),
    extraRules: existsSync(extraPath) ? extraPath : null,
    tsconfigRootDir: root,
    tsconfigs,
    untyped: tsconfigs.length > 0 ? untypedFiles(workspaceFiles, coveredFiles(tsconfigs, root)) : [],
    ignores: [...DEFAULT_IGNORES, ...(config.lint.ignores ?? [])],
  });
  const file = join(ensureDir(join(project.stateDir, 'eslint')), `${slug(workspace.dir)}.config.mjs`);
  writeFileSync(file, source);
  return file;
}
