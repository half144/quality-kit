// O preset rígido do quality-kit: o que as instruções de projeto pedem em texto
// vira erro de lint. Tudo é "error" (warning não trava nada e só acumula). A
// dívida de quando a régua entrou fica congelada na baseline, que só encolhe.
//
// Extraído do Flock (eslint.quality.js), sem as regras que só valem lá. As
// regras de um projeto entram por `lint-extra.cjs` na pasta da régua.

const DESIGN_RULES = {
  "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
  complexity: ["error", 15],
  "max-depth": ["error", 3],
  "max-params": ["error", 4],
  "max-nested-callbacks": ["error", 3],
  "no-nested-ternary": "error",
  "no-console": ["error", { allow: ["warn", "error"] }],
};

// Cheiros que o agente costuma deixar: ramo duplicado, função copiada, erro
// engolido, variável escrita e nunca lida, literal repetido.
const SONAR_RULES = {
  "sonarjs/cognitive-complexity": ["error", 15],
  "sonarjs/no-identical-functions": "error",
  "sonarjs/no-duplicate-string": ["error", { threshold: 3 }],
  "sonarjs/no-all-duplicated-branches": "error",
  "sonarjs/no-duplicated-branches": "error",
  "sonarjs/no-identical-conditions": "error",
  "sonarjs/no-identical-expressions": "error",
  "sonarjs/no-element-overwrite": "error",
  "sonarjs/no-gratuitous-expressions": "error",
  "sonarjs/no-collapsible-if": "error",
  "sonarjs/no-redundant-jump": "error",
  "sonarjs/no-redundant-boolean": "error",
  "sonarjs/no-inverted-boolean-check": "error",
  "sonarjs/prefer-single-boolean-return": "error",
  "sonarjs/no-useless-catch": "error",
  "sonarjs/no-ignored-exceptions": "error",
  "sonarjs/no-dead-store": "error",
  "sonarjs/no-unused-collection": "error",
};

// Gambiarras com cara conhecida: esperar a ordem com setTimeout 0, ganhar a
// especificidade com important, desligar o tipo com `as unknown as`.
const RESTRICTED_SYNTAX = [
  ...[
    "CallExpression[callee.name='setTimeout'][arguments.length=1]",
    "CallExpression[callee.name='setTimeout'][arguments.1.value=0]",
    "CallExpression[callee.property.name='setTimeout'][arguments.1.value=0]",
  ].map((selector) => ({ selector, message: "setTimeout com atraso 0 é gambiarra: resolva a ordem com o mecanismo oficial da plataforma." })),
  ...["JSXAttribute[name.name='className'] Literal[value=/(^|\\s)![\\w\\[-]|[\\w\\]]!(\\s|$)/]", "Literal[value=/!\\s*important/]"].map((selector) => ({
    selector,
    message: "Forçar prioridade de estilo (important) é gambiarra: resolva a especificidade na origem.",
  })),
  { selector: "TSAsExpression > TSAsExpression[typeAnnotation.type='TSUnknownKeyword']", message: "`as unknown as` desliga o tipo: corrija o tipo na origem." },
];

// Com informação de tipo: `any`, promessa esquecida, guarda para o que o tipo
// já garante, cast que não muda nada, switch que esquece um caso, API obsoleta.
const TYPESCRIPT_RULES = {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-non-null-assertion": "error",
  "@typescript-eslint/ban-ts-comment": "error",
  "@typescript-eslint/no-unused-vars": "error",
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": "error",
  "@typescript-eslint/await-thenable": "error",
  "@typescript-eslint/no-unnecessary-condition": "error",
  "@typescript-eslint/no-unnecessary-type-assertion": "error",
  "@typescript-eslint/switch-exhaustiveness-check": "error",
  "@typescript-eslint/no-deprecated": "error",
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-return": "error",
};

// Regra de qualidade não se desliga por comentário: o comentário é exatamente
// a saída que o agente usaria para não refatorar.
const LOCKED_RULES = [
  ...Object.keys(DESIGN_RULES),
  ...Object.keys(SONAR_RULES),
  ...Object.keys(TYPESCRIPT_RULES),
  "no-restricted-syntax",
  "no-restricted-imports",
  "react-hooks/*",
  "@eslint-community/eslint-comments/*",
];

const TESTS = ["**/*.test.*", "**/*.spec.*", "**/__tests__/**", "**/__mocks__/**", "e2e/**", "**/testing/**"];
const NODE_SCRIPTS = ["scripts/**", "**/*.config.{js,cjs,mjs,ts,mts,cts}"];
const TYPESCRIPT = ["**/*.{ts,tsx,mts,cts}"];

/**
 * O preset como lista de configs planas. `plugins` deixa reaproveitar a
 * instância que o projeto já registrou (o ESLint recusa o mesmo nome com dois
 * objetos diferentes).
 */
function buildQuality({ plugins, tsconfigRootDir, tsconfigs = [], restrictedSyntax = [] }) {
  // Com os tsconfig estritos gerados pelo kit, o lint vê os mesmos tipos que o
  // typecheck; sem tsconfig, o project service acha o mais próximo.
  const parserOptions = tsconfigs.length > 0 ? { project: tsconfigs, tsconfigRootDir } : { projectService: true, tsconfigRootDir };
  const syntax = ["error", ...RESTRICTED_SYNTAX, ...restrictedSyntax];
  return [
    { linterOptions: { reportUnusedDisableDirectives: "error", reportUnusedInlineConfigs: "error" } },
    {
      plugins: { sonarjs: plugins.sonarjs, "@eslint-community/eslint-comments": plugins.comments },
      rules: {
        ...DESIGN_RULES,
        ...SONAR_RULES,
        "no-restricted-syntax": syntax,
        "@eslint-community/eslint-comments/no-restricted-disable": ["error", ...LOCKED_RULES],
        "@eslint-community/eslint-comments/no-use": ["error", { allow: ["eslint-disable-next-line"] }],
        "@eslint-community/eslint-comments/require-description": "error",
        "@eslint-community/eslint-comments/no-unlimited-disable": "error",
        "@eslint-community/eslint-comments/no-aggregating-enable": "error",
        "@eslint-community/eslint-comments/no-duplicate-disable": "error",
        "@eslint-community/eslint-comments/no-unused-enable": "error",
      },
    },
    {
      files: TYPESCRIPT,
      plugins: { "@typescript-eslint": plugins.typescript },
      languageOptions: { parser: plugins.parser, parserOptions },
      rules: TYPESCRIPT_RULES,
    },
    {
      // Teste é longo por natureza e usa `!` e setTimeout para esperar e afirmar.
      files: TESTS,
      rules: {
        "max-lines": "off",
        "max-lines-per-function": "off",
        "max-nested-callbacks": "off",
        "no-console": "off",
        "no-restricted-syntax": "off",
        "sonarjs/no-duplicate-string": "off",
        "sonarjs/no-identical-functions": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
      },
    },
    { files: NODE_SCRIPTS, rules: { "no-console": "off" } },
  ];
}

function asError(entry) {
  if (entry === "warn" || entry === 1) return "error";
  if (Array.isArray(entry) && (entry[0] === "warn" || entry[0] === 1)) return ["error", ...entry.slice(1)];
  return entry;
}

/**
 * O lint roda com --max-warnings 0 e só "error" cabe no arquivo de
 * supressões: o warning do preset do projeto vira erro, para a dívida dele
 * também ficar congelada em vez de travar tudo.
 */
function warningsAsErrors(configs) {
  return configs.map((config) =>
    config.rules ? { ...config, rules: Object.fromEntries(Object.entries(config.rules).map(([rule, entry]) => [rule, asError(entry)])) } : config,
  );
}

module.exports = { buildQuality, warningsAsErrors, LOCKED_RULES, TYPESCRIPT_RULES, DESIGN_RULES };
