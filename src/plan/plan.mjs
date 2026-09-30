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

export const TEMPLATE = [
  'Goal: what changes for the user, one sentence',
  'Context: why now, what exists today, in one or two short sentences',
  'Where:',
  '- file-or-screen.tsx: what changes there',
  'How it works: the new flow, in one to four short lines',
  'Proof: which stills or video go in the PR',
].join('\n');

function normalize(text) {
  return `${text.trim()}\n`;
}

export function planHash(text) {
  return createHash('sha256').update(normalize(text)).digest('hex');
}

export function labelAt(line, labels) {
  return labels.find((label) => line.startsWith(`${label}:`)) ?? null;
}

function labelSet(firstLine) {
  return Object.values(LABELS).find((labels) => labelAt(firstLine, labels)) ?? LABELS.en;
}

/**
 * The plan split into its sections, in order; lines before the first label are
 * dropped. A section's `lines` are the text after its label (when there is
 * any) and the lines below it, as written, one entry per line of the plan.
 */
export function parsePlan(text) {
  const lines = text.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim() !== '');
  const labels = labelSet(lines[0] ?? '');
  const sections = [];
  for (const line of lines) {
    const label = labelAt(line, labels);
    if (label) sections.push({ label, lines: [line.slice(label.length + 1).trim()].filter(Boolean) });
    else sections.at(-1)?.lines.push(line.trim());
  }
  return { lines, labels, sections: sections.map((section) => ({ ...section, text: section.lines.join('\n') })) };
}

/** `missing`, `draft` (never approved), `approved` or `stale` (edited after the ok). */
export function planStatus(text, approval) {
  if (text === null) return 'missing';
  if (!approval) return 'draft';
  return approval.hash === planHash(text) ? 'approved' : 'stale';
}
