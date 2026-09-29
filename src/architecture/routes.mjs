/**
 * A pasta de rotas do framework (`app/` do Next e do Expo Router) só guarda
 * rota: o que o framework trata como arquivo especial. O código da rota mora
 * fora dela.
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
  return [[APP_ROUTES_ONLY, `"${fileName}" não é arquivo de rota do Next: mova para fora da pasta de rotas.`]];
}

function checkExpoFile(fileName, source) {
  if (isTest(fileName)) return [[APP_ROUTES_ONLY, 'o Expo Router trata todo arquivo da pasta de rotas como rota: teste o componente, não o arquivo de rota.']];
  if (EXPO_SPECIAL_FILE.test(fileName)) return [];
  if (!/\.tsx?$/.test(fileName)) return [[APP_ROUTES_ONLY, `"${fileName}" não é rota: o Expo Router só aceita rota ali.`]];
  const problems = [];
  if (!/export default/.test(source())) problems.push([APP_ROUTES_ONLY, `"${fileName}" não tem default export, então não é rota: mova para fora da pasta de rotas.`]);
  if (!EXPO_SEGMENT.test(baseName(fileName))) problems.push([ROUTE_SEGMENT_RULE, `rota "${fileName}" fora do padrão.`]);
  return problems;
}

const FRAMEWORKS = {
  next: { segment: NEXT_SEGMENT, checkFile: checkNextFile },
  'expo-router': { segment: EXPO_SEGMENT, checkFile: checkExpoFile },
};

/**
 * Os problemas de um arquivo dentro da pasta de rotas, como pares
 * [regra, mensagem]. `rest` são as partes do caminho abaixo da pasta.
 */
export function checkRouteFile(framework, rest, source) {
  const rules = FRAMEWORKS[framework];
  if (!rules) return [];
  const problems = [];
  for (const folder of rest.slice(0, -1)) {
    if (folder.startsWith('_')) problems.push([APP_ROUTES_ONLY, `pasta privada "${folder}" na pasta de rotas: o código da rota mora fora dela.`]);
    else if (!rules.segment.test(folder)) problems.push([ROUTE_SEGMENT_RULE, `segmento de rota "${folder}" fora do padrão.`]);
  }
  return [...problems, ...rules.checkFile(rest.at(-1), source)];
}
