/**
 * O checker na árvore inteira, recortado para o que a mudança tocou. A
 * violação que já existia quando a régua entrou fica na baseline (por arquivo
 * e regra) e não trava quem só passa pelo arquivo; a nova reprova, e a
 * baseline encolhe quando alguém conserta.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { checkRepository, formatViolations, violationsIn } from '../../architecture/checker.mjs';
import { architectureBaselinePath } from '../../config.mjs';
import { listFiles } from '../../git/git.mjs';
import { readJson } from '../../integrity/regua.mjs';
import { ensureDir } from '../../project.mjs';
import { countByFile, grownItems, shrinkBaseline } from '../debt.mjs';

/** Violações no formato de contagem por arquivo e regra (o mesmo do tsc). */
function asCounted(violations) {
  return violations.map((violation) => ({ ...violation, code: violation.rule }));
}

export function measureArchitecture(project, config) {
  const read = (file) => readFileSync(join(project.repo, file), 'utf8');
  return checkRepository(config.architecture, listFiles(project.repo), read);
}

export function architectureCounts(violations) {
  return countByFile(asCounted(violations));
}

export function architectureProblem({ project, config, changes, docPath }) {
  const touched = violationsIn(measureArchitecture(project, config), changes);
  const path = architectureBaselinePath(project.rulesDir);
  const baseline = readJson(path, {});
  const files = new Set([...changes.changed, ...changes.added.map((file) => dirname(file))]);
  const fresh = grownItems(asCounted(touched), baseline, files);
  if (fresh.length > 0) return `Arquitetura (${docPath}):${formatViolations(fresh)}`;
  const shrunk = shrinkBaseline(baseline, asCounted(touched), new Set(changes.changed));
  if (JSON.stringify(shrunk) !== JSON.stringify(baseline)) {
    ensureDir(dirname(path));
    writeFileSync(path, `${JSON.stringify(shrunk, null, 2)}\n`);
  }
  return null;
}
