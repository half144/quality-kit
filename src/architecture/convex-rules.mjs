/**
 * Regras de uma pasta `convex/`: o caminho do arquivo é a rota da função
 * (`convex/foo/bar.ts` vira `api.foo.bar`), então ele só aceita camelCase, e
 * na raiz e nas pastas de API só mora arquivo que registra função.
 */

import { baseName, follows, isTest } from './names.mjs';

const ROOT_FILES = ['schema.ts', 'http.ts', 'crons.ts', 'convex.config.ts', 'auth.config.ts', 'tsconfig.json', 'README.md'];
const INFRA_FOLDERS = ['_generated', 'model', 'lib', 'testing'];
const REGISTERED_FUNCTION = /^export const \w+ = (query|mutation|action|internalQuery|internalMutation|internalAction|httpAction|\w+(Query|Mutation|Action))\(/m;
const MOVE_LOGIC = 'arquivo sem query/mutation/action vai para model/<domínio> ou lib/.';

function nameProblems(parts) {
  if (!/\.(ts|js)$/.test(parts.at(-1))) return [];
  return [...parts.slice(0, -1), baseName(parts.at(-1))]
    .filter((part) => !follows('camel', part))
    .map((part) => ['convex-camel-case', `"${part}": em convex/ o caminho é a rota da função e só aceita camelCase (sem hífen).`]);
}

function infraProblems(root, parts, source) {
  const problems = [];
  if (parts[0] === 'model' && parts.length < 3) problems.push(['convex-model-domain', 'model/ é dividido por domínio: model/<domínio>/<arquivo>.ts.']);
  if (/\.ts$/.test(parts.at(-1)) && REGISTERED_FUNCTION.test(source())) {
    problems.push(['convex-root-api-only', `função registrada em ${parts[0]}/ fica escondida da API: ela mora na raiz de convex/ (ou numa pasta de API).`]);
  }
  return problems;
}

function apiProblems(parts, source) {
  if (REGISTERED_FUNCTION.test(source())) return [];
  if (parts.length === 1) return [['convex-root-api-only', `a raiz de convex/ é a API: ${MOVE_LOGIC}`]];
  return [['convex-api-folder', `convex/${parts[0]}/ é pasta de API (vira api.${parts[0]}.*): ${MOVE_LOGIC}`]];
}

/** Os problemas de um arquivo de `convex/`, como pares [regra, mensagem]. */
export function checkConvexFile(root, relative, source) {
  const parts = relative.split('/');
  if (parts[0] === '_generated') return [];
  const names = nameProblems(parts);
  const rootFiles = [...ROOT_FILES, ...(root.rootFiles ?? [])];
  if (isTest(relative) || rootFiles.includes(relative)) return names;
  const infra = parts.length > 1 && INFRA_FOLDERS.includes(parts[0]);
  return [...names, ...(infra ? infraProblems(root, parts, source) : apiProblems(parts, source))];
}
