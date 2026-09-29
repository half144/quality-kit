/**
 * The PR body, in the project's language: the tiny plan, the evidence (images
 * and videos embedded when uploaded, local paths when not) and a short gate
 * summary. Pure.
 */

import { parsePlan } from '../plan/plan.mjs';

const TEXT = {
  en: {
    plan: 'Plan',
    evidence: 'Evidence',
    gate: 'Gate',
    noEvidence: 'No screen changed: no screenshots or video.',
    local: 'Local file (not uploaded):',
    devices: { desktop: 'Desktop', phone: 'Phone' },
    passed: (checks) => `quality-kit passed on this change: ${checks.join(', ')}.`,
    checks: {
      architecture: 'architecture',
      lint: 'type-aware lint',
      typecheck: 'strict TypeScript',
      tests: 'related tests',
      testsAlongside: 'tests next to new files',
      suppressions: 'debt ratchet',
      knip: 'dead code',
      jscpd: 'duplication',
      verify: 'screens opened on desktop and mobile',
    },
  },
  'pt-BR': {
    plan: 'Plano',
    evidence: 'Evidências',
    gate: 'Gate',
    noEvidence: 'Nenhuma tela mudou: sem prints nem vídeo.',
    local: 'Arquivo local (sem upload):',
    devices: { desktop: 'Desktop', phone: 'Celular' },
    passed: (checks) => `O quality-kit passou nesta mudança: ${checks.join(', ')}.`,
    checks: {
      architecture: 'arquitetura',
      lint: 'lint com tipos',
      typecheck: 'TypeScript estrito',
      tests: 'testes relacionados',
      testsAlongside: 'teste ao lado de arquivo novo',
      suppressions: 'catraca da dívida',
      knip: 'código morto',
      jscpd: 'duplicação',
      verify: 'telas abertas no desktop e no celular',
    },
  },
};

function textOf(language) {
  return TEXT[language] ?? TEXT.en;
}

function planEntry({ label, text }) {
  if (/^- /m.test(text)) return `**${label}:**\n\n${text}`;
  return `**${label}:** ${text.split('\n').join('  \n')}`;
}

export function planSection(plan) {
  return parsePlan(plan).sections.map(planEntry).join('\n\n');
}

function media(item, words) {
  const label = `${item.screen} (${words.devices[item.device]})`;
  const caption = item.caption ? `\n> ${item.caption}` : '';
  if (!item.url) return `**${label}**  \n${words.local} \`${item.path}\`${caption}`;
  const embed = item.kind === 'video' ? item.url : `![${label}](${item.url})`;
  return `**${label}**\n\n${embed}${caption}`;
}

function evidenceSection(evidence, words) {
  if (evidence.length === 0) return words.noEvidence;
  return evidence.map((item) => media(item, words)).join('\n\n');
}

/** `evidence`: items with `url` (uploaded) or `path` (local fallback); `checks`: the checks that ran. */
export function prBody({ language, plan, evidence, checks }) {
  const words = textOf(language);
  return [
    `## ${words.plan}`,
    planSection(plan),
    `## ${words.evidence}`,
    evidenceSection(evidence, words),
    `## ${words.gate}`,
    words.passed(checks.map((check) => words.checks[check] ?? check)),
  ].join('\n\n');
}

/** The PR title: the plan's first section (the goal). */
export function prTitle(plan) {
  return parsePlan(plan).sections[0].text.split('\n')[0];
}
