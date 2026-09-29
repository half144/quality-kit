/**
 * What only team mode writes into the repo: the CI step, the Claude Code deny
 * list in `.claude/settings.json` and the AGENTS.md snippet Codex reads. The
 * workflow comments and the snippet follow the project's language.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { ensureDir } from '../project.mjs';
import { KIT_ROOT, kitVersion } from '../runtime.mjs';
import { docText } from './doc-text.mjs';
import { languageOf } from './language.mjs';

const START = '<!-- quality-kit:start -->';
const END = '<!-- quality-kit:end -->';
export const KIT_REPO = 'https://github.com/half144/quality-kit';

export const DENY = [
  'Edit(/.quality/config.json)',
  'Edit(/.quality/lint-extra.cjs)',
  'Edit(/.quality/knip.json)',
  'Edit(/.quality/baseline/**)',
  'Edit(/.githooks/**)',
  'Edit(/.github/workflows/quality.yml)',
  'Edit(/.claude/settings.json)',
  'Bash(*rules accept*)',
  'Bash(*quality-kit baseline*)',
  'Bash(*--no-verify*)',
  'Bash(* --suppress-all*)',
  'Bash(* --suppress-rule*)',
];

function yamlList(value) {
  return Array.isArray(value) ? `[${value.join(', ')}]` : value;
}

function installStep(install) {
  if (install.uses) return `      - uses: ${install.uses}`;
  return `      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n      - run: ${install.run}`;
}

export function workflowSource(ci, version = kitVersion(), language = 'en') {
  const { workflow } = docText(language);
  return `name: quality-kit

${workflow.comment}
on:
  pull_request:

jobs:
  gate:
    runs-on: ${yamlList(ci.runsOn)}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
${installStep(ci.install)}
      - name: ${workflow.installStep}
        run: |
          git clone --depth 1 --branch v${version} ${KIT_REPO} "$RUNNER_TEMP/quality-kit"
          npm ci --prefix "$RUNNER_TEMP/quality-kit" --no-audit --no-fund
      - name: Gate
        env:
          BASE: origin/\${{ github.base_ref }}
          REGUA_APROVADA: \${{ contains(github.event.pull_request.labels.*.name, 'regua-aprovada') }}
        run: |
          extra=""
          if [ "$REGUA_APROVADA" = true ]; then extra="--allow-regua-change"; fi
          node "$RUNNER_TEMP/quality-kit/bin/quality-kit.mjs" gate --ci --base "$BASE" $extra
`;
}

export function mergeDeny(settings) {
  const deny = [...new Set([...(settings.permissions?.deny ?? []), ...DENY])];
  return { ...settings, permissions: { ...settings.permissions, deny } };
}

export function mergeAgents(existing, snippet) {
  if (!existing) return `# AGENTS.md\n\n${snippet}`;
  const start = existing.indexOf(START);
  const end = existing.indexOf(END);
  if (start !== -1 && end !== -1) return existing.slice(0, start) + snippet.trim() + existing.slice(end + END.length);
  return `${existing.trimEnd()}\n\n${snippet}`;
}

function writeFile(path, content) {
  ensureDir(dirname(path));
  writeFileSync(path, content);
}

const SNIPPET_FILES = { en: 'AGENTS.snippet.md', 'pt-BR': 'AGENTS.snippet.pt-BR.md' };

/** The AGENTS.md snippet, in the project's language, with the paths of this project's documents. */
export function agentsSnippet(config) {
  return readFileSync(join(KIT_ROOT, 'templates', SNIPPET_FILES[languageOf(config)]), 'utf8')
    .replace('{architecture}', config.docs?.architecture ?? '.quality/ARCHITECTURE.md')
    .replace('{map}', config.docs?.map ?? '.quality/FEATURE_MAP.md');
}

/** Writes the team mode files and returns their paths. */
export function writeTeamFiles(repo, config) {
  const settingsPath = join(repo, '.claude', 'settings.json');
  const agentsPath = join(repo, 'AGENTS.md');
  const workflowPath = join(repo, '.github', 'workflows', 'quality.yml');
  const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {};
  writeFile(settingsPath, `${JSON.stringify(mergeDeny(settings), null, 2)}\n`);
  writeFile(agentsPath, mergeAgents(existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : null, agentsSnippet(config)));
  writeFile(workflowPath, workflowSource(config.ci, kitVersion(), languageOf(config)));
  return [settingsPath, agentsPath, workflowPath];
}
