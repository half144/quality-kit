/**
 * What makes a text a tiny plan: the five labels in order, and limits that
 * keep it readable in a few seconds. A long line is rejected, not wrapped:
 * the fix is to cut it. Research and design references belong in the
 * agent's work, not in the plan.
 *
 * Only `plan write` applies these; a plan saved by an older version still
 * loads, gets approved and ships.
 */

import { LABELS, labelAt, parsePlan } from './plan.mjs';

export const LIMITS = {
  lines: 15,
  lineChars: 120,
  goalLines: 1,
  contextLines: 2,
  contextSentences: 2,
  whereBullets: { min: 1, max: 5 },
  howLines: 4,
  proofLines: 2,
};

const BULLET = /^- /;
const PREVIEW = 40;

function preview(line) {
  return line.length > PREVIEW ? `${line.slice(0, PREVIEW)}…` : line;
}

function sentences(text) {
  const ends = text.match(/[.!?](?=\s|$)/g)?.length ?? 0;
  return /[.!?]$/.test(text) ? ends : ends + 1;
}

/** The label a line was meant to be ("Onde (nota):", "**Onde:**", "WHERE:"), as its index in the label list, or -1. */
function intendedLabel(line) {
  const bare = line.replace(/^[*#_\s]+/, '').toLowerCase();
  for (const labels of Object.values(LABELS)) {
    const index = labels.findIndex((label) => bare.startsWith(label.toLowerCase()) && /^\s*([(:*_–—-]|$)/.test(bare.slice(label.length)));
    if (index !== -1) return index;
  }
  return -1;
}

/** Each line meant as a label but not written as one, with the label it meant, by line index. */
function misnamedLabels(lines, labels) {
  return new Map(lines.flatMap((line, index) => {
    const intended = labelAt(line, labels) ? -1 : intendedLabel(line);
    return intended === -1 ? [] : [[index, labels[intended]]];
  }));
}

/** The plan as it was meant: each misnamed label written the right way, so the limits judge the right fields. */
function asMeant(lines, misnamed) {
  return lines.map((line, index) => {
    const label = misnamed.get(index);
    if (!label) return line;
    const colon = line.indexOf(':');
    return `${label}: ${colon === -1 ? '' : line.slice(colon + 1).replace(/^\**\s*/, '')}`.trimEnd();
  }).join('\n');
}

function misnamedErrors(lines, misnamed) {
  return [...misnamed].map(([index, label]) => `Line ${index + 1} ("${preview(lines[index])}") is read as text, not as the label "${label}:": start the line with exactly "${label}:" and move any note out of the label.`);
}

function structureErrors({ lines, labels, sections }) {
  const errors = [];
  if (!labelAt(lines[0] ?? '', labels)) errors.push(`It must start with "${labels[0]}:".`);
  const found = sections.map((section) => section.label);
  const missing = labels.filter((label) => !found.includes(label));
  errors.push(...missing.map((label) => `"${label}:" is missing: a line that starts with exactly "${label}:".`));
  errors.push(...labels.filter((label) => found.filter((entry) => entry === label).length > 1).map((label) => `"${label}:" appears more than once.`));
  if (missing.length === 0 && found.join('|') !== labels.join('|') && found.length === labels.length) errors.push(`The sections must be exactly, in this order: ${labels.map((label) => `"${label}:"`).join(', ')}.`);
  return errors;
}

function lineName(line, field, counts) {
  if (!field) return `Line "${preview(line)}"`;
  return BULLET.test(line) ? `"${field}:" bullet ${counts.bullets}` : `"${field}:" line ${counts.lines}`;
}

/** Each over-long line as written, named by its field ("Onde:" bullet 2), so the agent knows what to cut. */
function lineLengthErrors(written, meant, labels) {
  const errors = [];
  let field = null;
  let counts = { lines: 0, bullets: 0 };
  written.forEach((line, index) => {
    const label = labelAt(meant[index], labels);
    if (label) [field, counts] = [label, { lines: 0, bullets: 0 }];
    if (BULLET.test(line)) counts.bullets += 1;
    else counts.lines += 1;
    if (line.length <= LIMITS.lineChars) return;
    const name = label ? `"${label}:"` : lineName(line, field, counts);
    errors.push(`${name} has ${line.length} characters (limit ${LIMITS.lineChars}): cut it, don't wrap it onto another line.`);
  });
  return errors;
}

function whereErrors(section) {
  const bullets = section.lines.filter((line) => BULLET.test(line)).length;
  const { min, max } = LIMITS.whereBullets;
  if (bullets !== section.lines.length) return [`"${section.label}:" is a list: one "- file.tsx: what changes" bullet per line below the label, nothing after the colon.`];
  if (bullets < min || bullets > max) return [`"${section.label}:" has ${bullets} bullets: list ${min} to ${max} files or screens, the ones the owner needs to see.`];
  return [];
}

function contextErrors(section) {
  const count = sentences(section.lines.join(' '));
  if (section.lines.length <= LIMITS.contextLines && count <= LIMITS.contextSentences) return [];
  return [`"${section.label}:" has ${count} sentences on ${section.lines.length} lines: at most ${LIMITS.contextSentences} short sentences. Research and design references stay in your work, not in the plan.`];
}

function lineCapError(section, cap, what) {
  return section.lines.length > cap ? [`"${section.label}:" has ${section.lines.length} lines: ${what}.`] : [];
}

const SECTION_RULES = [
  (section) => lineCapError(section, LIMITS.goalLines, 'one line, one sentence'),
  contextErrors,
  whereErrors,
  (section) => lineCapError(section, LIMITS.howLines, `at most ${LIMITS.howLines} short lines`),
  (section) => lineCapError(section, LIMITS.proofLines, `at most ${LIMITS.proofLines} lines`),
];

function sectionErrors({ labels, sections }) {
  return sections.flatMap((section) => {
    if (section.lines.length === 0) return [`"${section.label}:" is empty.`];
    return SECTION_RULES[labels.indexOf(section.label)](section);
  });
}

/** What keeps the text from being a tiny plan; an empty list means it is one. */
export function planErrors(text) {
  const written = parsePlan(text);
  const misnamed = misnamedLabels(written.lines, written.labels);
  const plan = parsePlan(asMeant(written.lines, misnamed));
  const total = plan.lines.length > LIMITS.lines ? [`${plan.lines.length} lines: a tiny plan has at most ${LIMITS.lines}.`] : [];
  return [
    ...total,
    ...misnamedErrors(written.lines, misnamed),
    ...structureErrors(plan),
    ...lineLengthErrors(written.lines, plan.lines, plan.labels),
    ...sectionErrors(plan),
  ];
}
