/**
 * A config do ESLint que o gate usa no modo `kit`: a config do próprio projeto
 * (se houver) com o preset do kit e as regras extras da régua por cima. É
 * gerada a cada execução na pasta de estado (dentro de `.git`), então o repo
 * não muda.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { slug } from '../config.mjs';
import { ensureDir } from '../project.mjs';
import { depsRoot, KIT_ROOT, MissingDepsError } from '../runtime.mjs';

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
export function overlaySource({ deps, presetPath, projectConfig, extraRules, tsconfigRootDir, tsconfigs = [], ignores }) {
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

/** Grava a config do workspace e devolve o caminho dela. */
export function writeOverlay({ project, config, workspace }) {
  const deps = depsRoot();
  if (!deps) throw new MissingDepsError();
  const extraPath = join(project.rulesDir, config.lint.extraRules);
  const source = overlaySource({
    deps,
    presetPath: join(KIT_ROOT, 'src', 'lint', 'preset.cjs'),
    projectConfig: config.lint.projectConfig === false ? null : findProjectConfig(project.repo, workspace.dir),
    extraRules: existsSync(extraPath) ? extraPath : null,
    tsconfigRootDir: join(project.repo, workspace.dir),
    tsconfigs: writeStrictTsconfigs({ project, config, workspace }),
    ignores: [...DEFAULT_IGNORES, ...(config.lint.ignores ?? [])],
  });
  const file = join(ensureDir(join(project.stateDir, 'eslint')), `${slug(workspace.dir)}.config.mjs`);
  writeFileSync(file, source);
  return file;
}
