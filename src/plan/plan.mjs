/**
 * The tiny plan: five labeled sections the owner reads in a few seconds and
 * approves in chat. The approval is bound to the plan's hash, so editing the
 * plan after the ok takes the ok away.
 */

import { createHash } from 'node:crypto';

export const LABELS = {
  en: ['Goal', 'Context', 'Where', 'How it works', 'Proof'],
  'pt-BR': ['Objetivo', 'Contexto', 'Onde', 'Como funciona', 'Prova'],
};

export const MAX_LINES = 15;

export const TEMPLATE = LABELS.en.map((label) => `${label}: ...`).join('\n');

function normalize(text) {
  return `${text.trim()}\n`;
}

export function planHash(text) {
  return createHash('sha256').update(normalize(text)).digest('hex');
}

function labelAt(line, labels) {
  return labels.find((label) => line.startsWith(`${label}:`)) ?? null;
}

function labelSet(firstLine) {
  return Object.values(LABELS).find((labels) => labelAt(firstLine, labels)) ?? LABELS.en;
}

/** The plan split into its sections, in order; lines before the first label are dropped. */
export function parsePlan(text) {
  const lines = text.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim() !== '');
  const labels = labelSet(lines[0] ?? '');
  const sections = [];
  for (const line of lines) {
    const label = labelAt(line, labels);
    if (label) sections.push({ label, body: [line.slice(label.length + 1).trim()] });
    else sections.at(-1)?.body.push(line.trim());
  }
  return { lines, labels, sections: sections.map(({ label, body }) => ({ label, text: body.filter(Boolean).join('\n') })) };
}

/** What keeps the text from being a tiny plan; an empty list means it is one. */
export function planErrors(text) {
  const { lines, labels, sections } = parsePlan(text);
  const errors = [];
  if (lines.length > MAX_LINES) errors.push(`${lines.length} lines: a tiny plan has at most ${MAX_LINES}.`);
  if (!labelAt(lines[0] ?? '', labels)) errors.push(`It must start with "${labels[0]}:".`);
  const found = sections.map((section) => section.label);
  if (found.join('|') !== labels.join('|')) errors.push(`The sections must be exactly, in this order: ${labels.map((label) => `"${label}:"`).join(', ')}.`);
  for (const section of sections.filter((entry) => entry.text === '')) errors.push(`"${section.label}:" is empty.`);
  return errors;
}

/** `missing`, `draft` (never approved), `approved` or `stale` (edited after the ok). */
export function planStatus(text, approval) {
  if (text === null) return 'missing';
  if (!approval) return 'draft';
  return approval.hash === planHash(text) ? 'approved' : 'stale';
}
