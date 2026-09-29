/**
 * Regras de um arquivo dentro de uma raiz de código (`src/` de um app ou de
 * um pacote): pastas do topo, arquivos soltos, camadas da feature, pasta de
 * rotas, barril e nomes. Tudo vem da config; a ausência de uma opção desliga
 * a regra.
 */

import { baseName, follows, isComponentFile, isIndex, isTest } from './names.mjs';
import { checkRouteFile } from './routes.mjs';

/**
 * Onde um caminho abaixo da pasta de features cai: a feature (ou sub-feature)
 * dona e a camada. Pasta dentro da feature que não é camada é sub-feature, e
 * sub-feature só tem camadas.
 */
export function featureLayout(rest, layers) {
  const [feature, second, third] = rest;
  if (layers.includes(second)) return { feature, sub: null, unit: `${feature}`, layer: second };
  if (rest.length <= 2) return { feature, sub: null, unit: `${feature}`, layer: null };
  const layer = layers.includes(third) && rest.length > 3 ? third : null;
  return { feature, sub: second, unit: `${feature}/${second}`, layer };
}

function checkRootFile(root, fileName) {
  if (!root.rootFiles) return [];
  const tested = fileName.replace(/(\.dom)?\.(test|spec)(?=\.)/, '');
  if (root.rootFiles.includes(fileName) || (isTest(fileName) && root.rootFiles.includes(tested))) return [];
  const allowed = root.rootFiles.length > 0 ? `Só ${root.rootFiles.join(', ')} podem ficar aí.` : 'Nenhum arquivo fica solto aí.';
  return [['root-files', `arquivo solto na raiz ${root.path}/. ${allowed}`]];
}

function namingProblems(root, parts) {
  const { naming } = root;
  if (!naming) return [];
  const problems = [];
  for (const folder of parts.slice(0, -1)) {
    if (folder !== '__tests__' && !folder.startsWith('.') && !follows(naming.folders, folder)) {
      problems.push(['naming', `pasta "${folder}" fora de ${naming.folders}.`]);
    }
  }
  const fileName = parts.at(-1);
  const convention = isComponentFile(fileName) ? (naming.components ?? naming.files) : naming.files;
  if (!fileName.startsWith('.') && !follows(convention, baseName(fileName))) {
    problems.push(['naming', `arquivo "${fileName}" fora de ${convention}.`]);
  }
  return problems;
}

function featureProblems(root, parts) {
  const { features } = root;
  if (!features || parts[0] !== features.dir) return [];
  const layout = featureLayout(parts.slice(1), features.layers);
  if (layout.layer) return [];
  return [['feature-folders', `arquivo solto em ${features.dir}/${layout.unit}: ele vai para uma das pastas ${features.layers.join(', ')}.`]];
}

function nonRouteProblems(root, relative, parts) {
  return [
    ...(root.noBarrel && isIndex(relative) ? [['no-barrel', 'index reexportando é proibido: importe direto do arquivo.']] : []),
    ...namingProblems(root, parts),
    ...featureProblems(root, parts),
  ];
}

/**
 * Os problemas de um arquivo, como pares [regra, mensagem]. `relative` é o
 * caminho abaixo da raiz; `source()` lê o arquivo quando a regra precisa.
 */
export function checkAppFile(root, relative, source) {
  const parts = relative.split('/');
  if (parts.length === 1) return [...checkRootFile(root, relative), ...namingProblems(root, parts)];
  const [top, ...rest] = parts;
  if (root.allowedTop && !root.allowedTop.includes(top)) {
    return [['top-folders', `pasta "${top}" não existe no padrão. O topo de ${root.path}/ só tem: ${root.allowedTop.join(', ')}.`]];
  }
  const colocated = root.testsColocated && parts.includes('__tests__') ? [['tests-colocated', 'teste mora ao lado do arquivo testado (x.ts + x.test.ts), não em __tests__.']] : [];
  if (root.routes && top === root.routes.dir) return [...colocated, ...checkRouteFile(root.routes.framework, rest, source)];
  return [...colocated, ...nonRouteProblems(root, relative, parts)];
}
