/**
 * The tiny plan as markdown, the one rendering the owner sees: in chat
 * (`plan write`, `plan show`) and in the PR body. A one-line section stays on
 * its label's line; a section with more lines, or with bullets, becomes a
 * list under the label. A leading file path gets inline code. Pure.
 */

import { parsePlan } from './plan.mjs';

const PATH = /^([^\s`:,]*(?:\/[^\s`:,]*|\.[a-z][a-z0-9]{0,4}))(?=:\s|$)/i;

function codePath(text) {
  return text.replace(PATH, '`$1`');
}

function item(line) {
  return `- ${codePath(line.replace(/^- /, ''))}`;
}

function renderSection({ label, lines }) {
  if (lines.length === 1 && !lines[0].startsWith('- ')) return `**${label}:** ${lines[0]}`;
  return [`**${label}**`, ...lines.map(item)].join('\n');
}

export function renderPlan(text) {
  return parsePlan(text).sections.filter((section) => section.lines.length > 0).map(renderSection).join('\n\n');
}
