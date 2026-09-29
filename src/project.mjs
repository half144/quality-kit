/**
 * Where a project's ruleset lives and which mode it is in:
 *
 * - team: `.quality/` versioned in the repo itself;
 * - local: `~/.quality-kit/projects/<id>/`, outside the repo (nothing changes in it).
 *
 * Runtime state (gate cache, verify report, subagent marks) always lives in the
 * worktree's git folder, which is never pushed.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';

import { commonGitDir, gitDir, repoRoot } from './git/git.mjs';
import { kitHome } from './runtime.mjs';

export const TEAM_DIR = '.quality';

/** A stable id per repository: its worktrees share the same local ruleset. */
export function projectId(repo, common = commonGitDir(repo)) {
  const digest = createHash('sha256').update(realpathSync(common)).digest('hex').slice(0, 10);
  return `${basename(repo).replace(/[^a-zA-Z0-9_-]/g, '-')}-${digest}`;
}

export function localRulesDir(id) {
  return join(kitHome(), 'projects', id);
}

/**
 * The project for the given directory. `mode` is null when the kit is not set
 * up there yet: the plugin hook, installed per machine, does nothing there.
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
