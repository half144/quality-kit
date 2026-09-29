/**
 * The framework's routes folder (`app/` in Next and Expo Router) only holds
 * routes: what the framework treats as special files. The route's code lives
 * outside it.
 */

import { baseName, isTest } from './names.mjs';

export const APP_ROUTES_ONLY = 'app-routes-only';
const ROUTE_SEGMENT_RULE = 'route-segment';

const NEXT_ROUTE_FILE =
  /^(page|layout|route|loading|error|not-found|global-not-found|template|default|global-error|forbidden|unauthorized|sitemap|robots|manifest)\.(tsx?|jsx?)$|^(opengraph-image|twitter-image|icon|apple-icon)(\.alt)?\.(tsx?|png|jpe?g|gif|svg|ico|txt)$|^(favicon\.ico|globals\.css|robots\.txt|sitemap\.xml|manifest\.(json|webmanifest))$/;
const EXPO_SPECIAL_FILE = /^(_layout|\+not-found|\+html|\+native-intent)(\.(web|native|ios|android))?\.tsx?$/;
const NEXT_SEGMENT = /^(\([a-z0-9-]+\)|\[{1,2}(\.\.\.)?[a-zA-Z0-9]+\]{1,2}|@[a-z0-9-]+|[a-z0-9]+(-[a-z0-9]+)*)$/;
const EXPO_SEGMENT = /^(\([a-z0-9-]+\)|\[(\.\.\.)?[a-zA-Z0-9]+\]|[a-z0-9]+(-[a-z0-9]+)*)$/;

function withoutTestSuffix(fileName) {
  return fileName.replace(/(\.dom)?\.test(?=\.)/, '');
}

function checkNextFile(fileName) {
  if (NEXT_ROUTE_FILE.test(withoutTestSuffix(fileName))) return [];
  return [[APP_ROUTES_ONLY, `"${fileName}" is not a Next route file: move it out of the routes folder.`]];
}

function checkExpoFile(fileName, source) {
  if (isTest(fileName)) return [[APP_ROUTES_ONLY, 'Expo Router treats every file in the routes folder as a route: test the component, not the route file.']];
  if (EXPO_SPECIAL_FILE.test(fileName)) return [];
  if (!/\.tsx?$/.test(fileName)) return [[APP_ROUTES_ONLY, `"${fileName}" is not a route: Expo Router only accepts routes there.`]];
  const problems = [];
  if (!/export default/.test(source())) problems.push([APP_ROUTES_ONLY, `"${fileName}" has no default export, so it is not a route: move it out of the routes folder.`]);
  if (!EXPO_SEGMENT.test(baseName(fileName))) problems.push([ROUTE_SEGMENT_RULE, `route "${fileName}" does not follow the naming pattern.`]);
  return problems;
}

const FRAMEWORKS = {
  next: { segment: NEXT_SEGMENT, checkFile: checkNextFile },
  'expo-router': { segment: EXPO_SEGMENT, checkFile: checkExpoFile },
};

/**
 * The problems of a file inside the routes folder, as [rule, message] pairs.
 * `rest` is the path segments below the folder.
 */
export function checkRouteFile(framework, rest, source) {
  const rules = FRAMEWORKS[framework];
  if (!rules) return [];
  const problems = [];
  for (const folder of rest.slice(0, -1)) {
    if (folder.startsWith('_')) problems.push([APP_ROUTES_ONLY, `private folder "${folder}" in the routes folder: the route's code lives outside it.`]);
    else if (!rules.segment.test(folder)) problems.push([ROUTE_SEGMENT_RULE, `route segment "${folder}" does not follow the naming pattern.`]);
  }
  return [...problems, ...rules.checkFile(rest.at(-1), source)];
}
