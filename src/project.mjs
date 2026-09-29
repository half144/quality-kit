/**
 * Onde a régua de um projeto mora e em que modo ele está:
 *
 * - time: `.quality/` versionado no próprio repo;
 * - local: `~/.quality-kit/projects/<id>/`, fora do repo (nada muda nele).
 *
 * O estado de execução (cache do gate, relatório do verify, marcas de
 * subagente) fica sempre na pasta do git da worktree, que nunca sobe.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';

import { commonGitDir, gitDir, repoRoot } from './git/git.mjs';
import { kitHome } from './runtime.mjs';

export const TEAM_DIR = '.quality';

/** Um id estável por repositório: as worktrees dele dividem a mesma régua local. */
export function projectId(repo, common = commonGitDir(repo)) {
  const digest = createHash('sha256').update(realpathSync(common)).digest('hex').slice(0, 10);
  return `${basename(repo).replace(/[^a-zA-Z0-9_-]/g, '-')}-${digest}`;
}

export function localRulesDir(id) {
  return join(kitHome(), 'projects', id);
}

/**
 * O projeto do diretório dado. `mode` é null quando o kit ainda não foi
 * montado nele: o hook do plugin, instalado na máquina, não faz nada ali.
 */
export function locateProject(cwd) {
  const repo = repoRoot(cwd);
  const id = projectId(repo);
  const teamDir = join(repo, TEAM_DIR);
  const localDir = localRulesDir(id);
  const stateDir = join(gitDir(repo), 'quality-kit');
  if (existsSync(join(teamDir, 'config.json'))) return { repo, id, mode: 'team', rulesDir: teamDir, stateDir };
  if (existsSync(join(localDir, 'config.json'))) return { repo, id, mode: 'local', rulesDir: localDir, stateDir };
  return { repo, id, mode: null, rulesDir: null, stateDir };
}

export function rulesDirFor(project, mode) {
  return mode === 'team' ? join(project.repo, TEAM_DIR) : localRulesDir(project.id);
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}
