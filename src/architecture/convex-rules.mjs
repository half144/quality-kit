/**
 * Rules for a `convex/` folder: the file path is the function's route
 * (`convex/foo/bar.ts` becomes `api.foo.bar`), so it only accepts camelCase,
 * and the root and the API folders only hold files that register functions.
 */

import { baseName, follows, isTest } from './names.mjs';

const ROOT_FILES = ['schema.ts', 'http.ts', 'crons.ts', 'convex.config.ts', 'auth.config.ts', 'tsconfig.json', 'README.md'];
const INFRA_FOLDERS = ['_generated', 'model', 'lib', 'testing'];
const REGISTERED_FUNCTION = /^export const \w+ = (query|mutation|action|internalQuery|internalMutation|internalAction|httpAction|\w+(Query|Mutation|Action))\(/m;
const MOVE_LOGIC = 'a file without a query/mutation/action belongs in model/<domain> or lib/.';

function nameProblems(parts) {
  if (!/\.(ts|js)$/.test(parts.at(-1))) return [];
  return [...parts.slice(0, -1), baseName(parts.at(-1))]
    .filter((part) => !follows('camel', part))
    .map((part) => ['convex-camel-case', `"${part}": in convex/ the path is the function's route and only accepts camelCase (no hyphens).`]);
}

function infraProblems(root, parts, source) {
  const problems = [];
  if (parts[0] === 'model' && parts.length < 3) problems.push(['convex-model-domain', 'model/ is split by domain: model/<domain>/<file>.ts.']);
  if (/\.ts$/.test(parts.at(-1)) && REGISTERED_FUNCTION.test(source())) {
    problems.push(['convex-root-api-only', `a function registered in ${parts[0]}/ is hidden from the API: it belongs at the root of convex/ (or in an API folder).`]);
  }
  return problems;
}

function apiProblems(parts, source) {
  if (REGISTERED_FUNCTION.test(source())) return [];
  if (parts.length === 1) return [['convex-root-api-only', `the root of convex/ is the API: ${MOVE_LOGIC}`]];
  return [['convex-api-folder', `convex/${parts[0]}/ is an API folder (it becomes api.${parts[0]}.*): ${MOVE_LOGIC}`]];
}

/** A `convex/` file's problems, as [rule, message] pairs. */
export function checkConvexFile(root, relative, source) {
  const parts = relative.split('/');
  if (parts[0] === '_generated') return [];
  const names = nameProblems(parts);
  const rootFiles = [...ROOT_FILES, ...(root.rootFiles ?? [])];
  if (isTest(relative) || rootFiles.includes(relative)) return names;
  const infra = parts.length > 1 && INFRA_FOLDERS.includes(parts[0]);
  return [...names, ...(infra ? infraProblems(root, parts, source) : apiProblems(parts, source))];
}
