/**
 * The text of every file `setup` generates in the target project, per
 * language. Keep both languages in step: same keys, same meaning.
 */

const list = (names) => names.map((name) => `\`${name}\``).join(', ');

const en = {
  convexRoot: (path) => [`### \`${path}/\` (Convex)`, '', '- The file path is the function route: camelCase only, no hyphens.', '- The root and the API folders only hold files that register a query, mutation or action; logic goes in `model/<domain>/` or `lib/`.'],
  allowedTop: (names) => `- Allowed top-level folders: ${list(names)}. A new top-level folder is a ruleset change.`,
  rootFiles: (names) => `- Loose files at the root: only ${list(names) || 'none'}.`,
  naming: (naming) => `- Names: files ${naming.files}, components ${naming.components ?? naming.files}, folders ${naming.folders} (\`any\` is unrestricted).`,
  noBarrel: '- No barrels: a re-exporting `index.ts` hides where things live; import straight from the file.',
  testsColocated: '- Tests sit next to the file (`x.ts` + `x.test.ts`), never in `__tests__/`.',
  routes: ({ dir, framework }) => `- \`${dir}/\` is the ${framework} routes folder: route files only. Screen code lives outside it, and only \`${dir}/\` imports from \`${dir}/\`.`,
  features: ({ dir, layers }) => `- \`${dir}/<feature>/\` holds the code of each feature, always inside a layer: ${list(layers)}.`,
  importDirection: '- Import direction: shared → feature → routes. A feature does not import from another; what two of them use moves up to shared. A sub-feature imports from the root of its own feature, never from a sibling.',
  forbiddenImport: (rule) => `- Forbidden import: \`${rule.from}\` → \`${rule.to}\` (${rule.message})`,
  architecture: {
    title: '# Architecture',
    intro: [
      "This project's structure ruleset, checked by the quality-kit checker on every gate run. Each violation cites its rule.",
      'What already existed when the ruleset came in is in the baseline and does not block someone just passing through the file; new code is born inside the ruleset.',
    ],
    where: '## Where things live',
    limits: '## Limits',
    folderSize: (max) => `- Up to ${max} code files per folder (tests and styles not counted). Past that, split into subfolders by subject.`,
    noFolderSize: '- No cap on files per folder.',
    eslint: '- Kit ESLint: ~300 lines per file, 80 per function, complexity 15, nesting 3, 4 parameters.',
    change: '## Changing the ruleset',
    changeBody: 'The ruleset lives in the quality-kit config, not in this text. Changing a folder, layer or limit is a human decision: edit the config and run `quality-kit rules accept` in a terminal.',
  },
  map: {
    title: '# Screen map',
    intro: 'Every screen, where it comes from and how to open it. `quality-kit verify` reads it to know what to open, and the gate uses it to require on-screen proof.',
    legend: [
      "- **File:** the screen file, relative to the app's routes folder (or to `src`, if routing is not file-based). It is the key.",
      '- **Route:** the path the framework builds.',
      '- **Open at:** the path verify opens. Without a path in backticks, the screen has no automatic proof and the reason is written down.',
      '- **Feature:** the folders (relative to `src`) that feed the screen. A change in any of them puts the screen in `quality-kit verify --changed`.',
    ],
    header: '| File | Route | Open at | Summary | Feature |',
    needsDemoData: 'needs demo data',
    entryScreen: 'Home screen',
  },
  playbooks: {
    title: '# Playbooks supplement',
    intro: "This project's real commands, for the steps of the quality-kit playbooks.",
    gate: '## Gate (the same as the Claude hook, the git hooks and CI)',
    gateLines: [
      '- `quality-kit gate`: every check on the touched files.',
      '- `quality-kit gate --profile fast`: structure, colocated tests and the debt ratchet only.',
      '- `quality-kit verify --changed`: on-screen proof of the affected screens.',
    ],
    scripts: '## Project scripts',
    noScripts: '- (no scripts in package.json)',
    tests: '## Tests per workspace',
    customTest: 'custom command',
  },
  lintExtra: `// This project's own lint rules, added on top of the quality-kit preset.
// The \`gardener\` skill adds here the anti-pattern that showed up a second
// time. Changing this file changes the ruleset: the gate fails until a human
// runs \`quality-kit rules accept\`.
//
// restrictedSyntax: no-restricted-syntax selectors, added to the preset's.
// configs: flat ESLint configs (for example no-restricted-imports).
`,
  workflow: {
    comment: `# The quality-kit gate on the PR: the same checks as the Claude hook and the
# git hooks, on the files the PR touches. A ruleset change (.quality/) only
# passes with the \`regua-aprovada\` label, added by the reviewer.`,
    installStep: 'Install the quality-kit',
  },
  hook: {
    comment: (name) => `the ruleset gate (${name}). Without the kit on this machine, warn and go on; CI enforces it anyway.`,
    missing: (name) => `quality-kit is not installed on this machine: the ${name} gate did not run.`,
  },
};

const ptBR = {
  convexRoot: (path) => [`### \`${path}/\` (Convex)`, '', '- O caminho é a rota da função: só camelCase, sem hífen.', '- Na raiz e nas pastas de API só mora arquivo que registra query, mutation ou action; lógica vai para `model/<domínio>/` ou `lib/`.'],
  allowedTop: (names) => `- Pastas do topo permitidas: ${list(names)}. Pasta nova no topo é mudança de régua.`,
  rootFiles: (names) => `- Arquivos soltos na raiz: só ${list(names) || 'nenhum'}.`,
  naming: (naming) => `- Nomes: arquivos ${naming.files}, componentes ${naming.components ?? naming.files}, pastas ${naming.folders} (\`any\` é livre).`,
  noBarrel: '- Sem barril: `index.ts` reexportando esconde onde a coisa mora; importe direto do arquivo.',
  testsColocated: '- Teste ao lado do arquivo (`x.ts` + `x.test.ts`), nunca em `__tests__/`.',
  routes: ({ dir, framework }) => `- \`${dir}/\` é a pasta de rotas do ${framework}: só arquivo de rota. O código da tela mora fora dela, e só \`${dir}/\` importa de \`${dir}/\`.`,
  features: ({ dir, layers }) => `- \`${dir}/<feature>/\` guarda o código de cada funcionalidade, sempre dentro de uma camada: ${list(layers)}.`,
  importDirection: '- Direção dos imports: compartilhado → feature → rotas. Uma feature não importa de outra; o que duas usam sobe para o compartilhado. Sub-feature importa da raiz da própria feature, nunca de uma irmã.',
  forbiddenImport: (rule) => `- Import proibido: \`${rule.from}\` → \`${rule.to}\` (${rule.message})`,
  architecture: {
    title: '# Arquitetura',
    intro: [
      'A régua de estrutura deste projeto, conferida pelo checker do quality-kit em todo gate. Cada violação cita a regra.',
      'O que já existia quando a régua entrou está na baseline e não trava quem só passa pelo arquivo; o código novo nasce dentro da régua.',
    ],
    where: '## Onde cada coisa mora',
    limits: '## Limites',
    folderSize: (max) => `- Até ${max} arquivos de código por pasta (sem contar teste e estilo). Passou disso, divida em subpastas por assunto.`,
    noFolderSize: '- Sem teto de arquivos por pasta.',
    eslint: '- ESLint do kit: ~300 linhas por arquivo, 80 por função, complexidade 15, aninhamento 3, 4 parâmetros.',
    change: '## Mudar a régua',
    changeBody: 'A régua mora na config do quality-kit, não neste texto. Mudar pasta, camada ou limite é decisão humana: edite a config e rode `quality-kit rules accept` num terminal.',
  },
  map: {
    title: '# Mapa de telas',
    intro: 'Toda tela, de onde ela vem e como abri-la. É o que o `quality-kit verify` lê para saber o que abrir, e o que o gate usa para cobrar a prova na tela.',
    legend: [
      '- **Arquivo:** o arquivo da tela, relativo à pasta de rotas do app (ou ao `src`, se o roteamento não é por arquivo). É a chave.',
      '- **Rota:** o caminho que o framework monta.',
      '- **Abrir em:** o caminho que o verify abre. Sem caminho entre crases, a tela não tem prova automática e o motivo fica escrito.',
      '- **Feature:** as pastas (relativas ao `src`) que alimentam a tela. Mudança numa delas põe a tela no `quality-kit verify --changed`.',
    ],
    header: '| Arquivo | Rota | Abrir em | Resumo | Feature |',
    needsDemoData: 'precisa de dado de demonstração',
    entryScreen: 'Tela inicial',
  },
  playbooks: {
    title: '# Complemento dos playbooks',
    intro: 'Os comandos reais deste projeto, para os passos dos playbooks do quality-kit.',
    gate: '## Gate (o mesmo do hook, dos hooks do git e do CI)',
    gateLines: [
      '- `quality-kit gate`: todos os checks nos arquivos tocados.',
      '- `quality-kit gate --profile fast`: só estrutura, teste ao lado e catraca da dívida.',
      '- `quality-kit verify --changed`: prova na tela das telas afetadas.',
    ],
    scripts: '## Scripts do projeto',
    noScripts: '- (nenhum script no package.json)',
    tests: '## Testes por workspace',
    customTest: 'comando próprio',
  },
  lintExtra: `// Regras de lint próprias deste projeto, somadas ao preset do quality-kit.
// A skill \`gardener\` acrescenta aqui o anti-padrão que apareceu pela segunda
// vez. Mudar este arquivo é mudar a régua: o gate reprova até um humano rodar
// \`quality-kit rules accept\`.
//
// restrictedSyntax: seletores do no-restricted-syntax, somados aos do preset.
// configs: configs planas do ESLint (por exemplo no-restricted-imports).
`,
  workflow: {
    comment: `# O gate do quality-kit no PR: os mesmos checks do hook do Claude e dos hooks
# do git, nos arquivos que o PR toca. Mudança na régua (.quality/) só passa com
# o rótulo \`regua-aprovada\`, posto por quem revisa.`,
    installStep: 'Instalar o quality-kit',
  },
  hook: {
    comment: (name) => `o gate da régua (${name}). Sem o kit na máquina, avisa e segue; o CI cobra de qualquer jeito.`,
    missing: (name) => `quality-kit não instalado nesta máquina: o gate do ${name} não rodou.`,
  },
};

const TEXT = { en, 'pt-BR': ptBR };

export function docText(language) {
  return TEXT[language];
}
