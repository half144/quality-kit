/**
 * Where a project's ruleset lives and which mode it is in:
 *
 * - team: `.quality/` versioned in the repo itself;
 * - local: `~/.quality-kit/projects/<id>/`, outside the repo (nothing changes in it),
 *   one id per repository, shared by all its worktrees.
 *
 * Runtime state (gate cache, verify report, subagent marks) always lives in the
 * worktree's git folder, which is never pushed.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { commonGitDir, gitDir, repoRoot } from './git/git.mjs';
import { adoptLegacyProject } from './project-legacy.mjs';
import { kitHome } from './runtime.mjs';

export const TEAM_DIR = '.quality';

function idOf(name, common) {
  const digest = createHash('sha256').update(common).digest('hex').slice(0, 10);
  return `${name.replace(/[^a-zA-Z0-9_-]/g, '-')}-${digest}`;
}

/**
 * The repository's name, the same from every worktree: the main checkout's
 * folder (`app/.git` -> `app`), or the bare repository's (`app.git` -> `app`).
 */
export function repositoryName(common) {
  return basename(common) === '.git' ? basename(dirname(common)) : basename(common).replace(/\.git$/, '');
}

/**
 * A stable id per repository: its worktrees share the same local ruleset and
 * branch state. Both halves come from the common git folder; for the main
 * checkout the id is the same as before v0.3.6.
 */
export function projectId(common) {
  return idOf(repositoryName(common), common);
}

/**
 * The id up to v0.3.5, named after the worktree folder: a Paseo worktree
 * (`harsh-pony`) got its own id, so a local ruleset set up in one worktree
 * did not exist in the others, and each worktree kept its own branch state.
 */
export function legacyProjectId(repo, common) {
  return idOf(basename(repo), common);
}

export function localRulesDir(id) {
  return join(kitHome(), 'projects', id);
}

/**
 * The project for the given directory. `mode` is null when the kit is not set
 * up there yet: the plugin hook, installed per machine, does nothing there.
 *
 * `acceptanceId` names the signed acceptance. In local mode it is the
 * repository's, like the one ruleset it accepts. In team mode the ruleset is
 * whatever the checked-out branch versions, so each worktree keeps its own
 * acceptance, under the id it always had: worktrees on branches with
 * different rulesets do not overwrite each other's.
 */
export function locateProject(cwd) {
  const repo = repoRoot(cwd);
  const common = realpathSync(commonGitDir(repo));
  const id = projectId(common);
  const worktreeId = legacyProjectId(repo, common);
  adoptLegacyProject(worktreeId, id);
  const teamDir = join(repo, TEAM_DIR);
  const localDir = localRulesDir(id);
  const stateDir = join(gitDir(repo), 'quality-kit');
  const base = { repo, id, acceptanceId: id, stateDir };
  if (existsSync(join(teamDir, 'config.json'))) return { ...base, acceptanceId: worktreeId, mode: 'team', rulesDir: teamDir };
  if (existsSync(join(localDir, 'config.json'))) return { ...base, mode: 'local', rulesDir: localDir };
  return { ...base, mode: null, rulesDir: null };
}

export function rulesDirFor(project, mode) {
  return mode === 'team' ? join(project.repo, TEAM_DIR) : localRulesDir(project.id);
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}
