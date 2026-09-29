/**
 * Os documentos que a skill `setup` gera na pasta da régua: ARCHITECTURE.md
 * (a régua em texto, lida da config), FEATURE_MAP.md (o mapa de telas, com as
 * rotas deduzidas do código), PLAYBOOKS.md (os comandos reais do projeto para
 * os playbooks) e o lint-extra.cjs vazio.
 */

import { normalizeApps } from '../verify/apps.mjs';
import { screenFiles } from '../verify/feature-map.mjs';

function rootSection(root) {
  if (root.kind === 'convex') {
    return [`### \`${root.path}/\` (Convex)`, '', '- O caminho é a rota da função: só camelCase, sem hífen.', '- Na raiz e nas pastas de API só mora arquivo que registra query, mutation ou action; lógica vai para `model/<domínio>/` ou `lib/`.'].join('\n');
  }
  const lines = [`### \`${root.path}/\``, ''];
  if (root.allowedTop) lines.push(`- Pastas do topo permitidas: ${root.allowedTop.map((name) => `\`${name}\``).join(', ')}. Pasta nova no topo é mudança de régua.`);
  if (root.rootFiles) lines.push(`- Arquivos soltos na raiz: só ${root.rootFiles.map((name) => `\`${name}\``).join(', ') || 'nenhum'}.`);
  if (root.naming) lines.push(`- Nomes: arquivos ${root.naming.files}, componentes ${root.naming.components ?? root.naming.files}, pastas ${root.naming.folders} (\`any\` é livre).`);
  if (root.noBarrel) lines.push('- Sem barril: `index.ts` reexportando esconde onde a coisa mora; importe direto do arquivo.');
  if (root.testsColocated) lines.push('- Teste ao lado do arquivo (`x.ts` + `x.test.ts`), nunca em `__tests__/`.');
  if (root.routes) lines.push(`- \`${root.routes.dir}/\` é a pasta de rotas do ${root.routes.framework}: só arquivo de rota. O código da tela mora fora dela, e só \`${root.routes.dir}/\` importa de \`${root.routes.dir}/\`.`);
  if (root.features) {
    lines.push(`- \`${root.features.dir}/<feature>/\` guarda o código de cada funcionalidade, sempre dentro de uma camada: ${root.features.layers.map((name) => `\`${name}\``).join(', ')}.`);
    lines.push('- Direção dos imports: compartilhado → feature → rotas. Uma feature não importa de outra; o que duas usam sobe para o compartilhado. Sub-feature importa da raiz da própria feature, nunca de uma irmã.');
  }
  for (const rule of root.imports?.forbid ?? []) lines.push(`- Import proibido: \`${rule.from}\` → \`${rule.to}\` (${rule.message})`);
  return lines.join('\n');
}

export function architectureDoc(config) {
  const { roots, folderSize } = config.architecture;
  return [
    '# Arquitetura',
    '',
    'A régua de estrutura deste projeto, conferida pelo checker do quality-kit em todo gate. Cada violação cita a regra.',
    'O que já existia quando a régua entrou está na baseline e não trava quem só passa pelo arquivo; o código novo nasce dentro da régua.',
    '',
    '## Onde cada coisa mora',
    '',
    ...roots.map(rootSection).flatMap((section) => [section, '']),
    '## Limites',
    '',
    folderSize ? `- Até ${folderSize.max} arquivos de código por pasta (sem contar teste e estilo). Passou disso, divida em subpastas por assunto.` : '- Sem teto de arquivos por pasta.',
    '- ESLint do kit: ~300 linhas por arquivo, 80 por função, complexidade 15, aninhamento 3, 4 parâmetros.',
    '',
    '## Mudar a régua',
    '',
    'A régua mora na config do quality-kit, não neste texto. Mudar pasta, camada ou limite é decisão humana: edite a config e rode `quality-kit rules accept` num terminal.',
    '',
  ].join('\n');
}

function isDynamic(route) {
  return /\[|\(\.\.\.|:/.test(route);
}

function row({ file, route, open, summary, features }) {
  const openCell = open ? `\`${open}\`` : 'precisa de dado de demonstração';
  return `| \`${file}\` | \`${route}\` | ${openCell} | ${summary} | ${features.map((feature) => `\`${feature}\``).join(' ')} |`;
}

function appRows(app, files, extra) {
  const deduced = screenFiles([app], files).map((screen) => ({ ...screen, open: isDynamic(screen.route) ? null : screen.route, summary: '', features: [] }));
  const rows = [...deduced, ...extra.filter((screen) => screen.app === app.name)];
  if (rows.length > 0) return rows;
  const entry = ['App.tsx', 'App.jsx', 'main.tsx', 'main.jsx', 'index.tsx'].find((name) => files.includes(`${app.src}${name}`));
  return entry ? [{ file: entry, route: '/', open: '/', summary: 'Tela inicial', features: [] }] : [];
}

export function featureMapDoc(config, files, extraScreens = []) {
  const apps = normalizeApps(config.verify);
  const sections = apps.flatMap((app) => [
    `## ${app.name} (\`${app.src}\`)`,
    '',
    '| Arquivo | Rota | Abrir em | Resumo | Feature |',
    '| --- | --- | --- | --- | --- |',
    ...appRows(app, files, extraScreens).map(row),
    '',
  ]);
  return [
    '# Mapa de telas',
    '',
    'Toda tela, de onde ela vem e como abri-la. É o que o `quality-kit verify` lê para saber o que abrir, e o que o gate usa para cobrar a prova na tela.',
    '',
    '- **Arquivo:** o arquivo da tela, relativo à pasta de rotas do app (ou ao `src`, se o roteamento não é por arquivo). É a chave.',
    '- **Rota:** o caminho que o framework monta.',
    '- **Abrir em:** o caminho que o verify abre. Sem caminho entre crases, a tela não tem prova automática e o motivo fica escrito.',
    '- **Feature:** as pastas (relativas ao `src`) que alimentam a tela. Mudança numa delas põe a tela no `quality-kit verify --changed`.',
    '',
    ...sections,
  ].join('\n');
}

export function playbooksDoc(detection, config) {
  const run = detection.packageManager === 'npm' ? 'npm run' : detection.packageManager;
  const scripts = detection.packages.flatMap((pkg) => Object.keys(pkg.scripts).map((name) => `- \`${pkg.dir ? `${pkg.dir}: ` : ''}${run} ${name}\`: \`${pkg.scripts[name]}\``));
  return [
    '# Complemento dos playbooks',
    '',
    'Os comandos reais deste projeto, para os passos dos playbooks do quality-kit.',
    '',
    '## Gate (o mesmo do hook, dos hooks do git e do CI)',
    '',
    '- `quality-kit gate`: todos os checks nos arquivos tocados.',
    '- `quality-kit gate --profile fast`: só estrutura, teste ao lado e catraca da dívida.',
    '- `quality-kit verify --changed`: prova na tela das telas afetadas.',
    '',
    '## Scripts do projeto',
    '',
    ...(scripts.length > 0 ? scripts : ['- (nenhum script no package.json)']),
    '',
    '## Testes por workspace',
    '',
    ...config.workspaces.map((workspace) => `- \`${workspace.dir || '.'}\`: ${typeof workspace.test === 'string' ? workspace.test : 'comando próprio'}`),
    '',
  ].join('\n');
}

export const LINT_EXTRA_TEMPLATE = `// Regras de lint próprias deste projeto, somadas ao preset do quality-kit.
// A skill \`gardener\` acrescenta aqui o anti-padrão que apareceu pela segunda
// vez. Mudar este arquivo é mudar a régua: o gate reprova até um humano rodar
// \`quality-kit rules accept\`.
//
// restrictedSyntax: seletores do no-restricted-syntax, somados aos do preset.
// configs: configs planas do ESLint (por exemplo no-restricted-imports).
module.exports = {
  restrictedSyntax: [],
  configs: [],
};
`;
