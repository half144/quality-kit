// The branch folder follows a renamed branch, and one project id per
// repository, whichever worktree the kit runs from.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

const home = mkdtempSync(join(tmpdir(), 'qk-home-'));
const root = realpathSync(mkdtempSync(join(tmpdir(), 'qk-branch-')));
const repo = join(root, 'app');
process.env.QUALITY_KIT_HOME = home;

const { branchDir } = await import('../src/branch/state.mjs');
const { formerNames } = await import('../src/branch/rename.mjs');
const { readManifest, rebaseItems, writeManifest } = await import('../src/evidence/manifest.mjs');
const { recordPath } = await import('../src/integrity/integrity.mjs');
const { approvePlan, readPlan, writePlan } = await import('../src/plan/store.mjs');
const { legacyProjectId, localRulesDir, locateProject, projectId, repositoryName } = await import('../src/project.mjs');

const PLAN = 'Goal: a helper for new numbers\nContext: none exists\nWhere:\n- src/lib/nova.ts\nHow it works: returns one\nProof: its unit test';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function currentDir(cwd = repo) {
  return branchDir(locateProject(cwd));
}

function branchesRoot() {
  return join(localRulesDir(locateProject(repo).id), 'branches');
}

function commonDir() {
  return realpathSync(join(repo, '.git'));
}

before(() => {
  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 't@t');
  git(repo, 'config', 'user.name', 't');
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'base');
});

after(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(root, { recursive: true, force: true });
});

test('formerNames follows a chain of renames and ignores the rest of the reflog', () => {
  const reflog = [
    'commit: work',
    'Branch: renamed refs/heads/b to refs/heads/feat/c',
    'Branch: renamed refs/heads/x to refs/heads/y',
    'Branch: renamed refs/heads/a to refs/heads/b',
    'branch: Created from HEAD',
  ].join('\n');
  assert.deepEqual(formerNames(reflog, 'feat/c'), ['b', 'a']);
  assert.deepEqual(formerNames(reflog, 'other'), []);
  assert.deepEqual(formerNames('', 'feat/c'), []);
});

test('repositoryName is the main checkout or bare repository name', () => {
  assert.equal(repositoryName('/w/app/.git'), 'app');
  assert.equal(repositoryName('/w/app.git'), 'app');
  assert.equal(repositoryName('/w/app/.git/modules/sub'), 'sub');
});

test('rebaseItems points the evidence at the moved folder', () => {
  const items = [{ kind: 'still', file: '/b/old/evidence/a.png', framed: '/b/old/evidence/a-framed.png' }, { kind: 'video', file: '/elsewhere/v.mp4' }];
  assert.deepEqual(rebaseItems(items, '/b/old', '/b/new'), [
    { kind: 'still', file: '/b/new/evidence/a.png', framed: '/b/new/evidence/a-framed.png' },
    { kind: 'video', file: '/elsewhere/v.mp4', framed: undefined },
  ]);
});

test('a plan written before a rename is approved after it, with its evidence', () => {
  git(repo, 'checkout', '-q', '-b', 'harsh-pony');
  const former = currentDir();
  writePlan(former, PLAN);
  writeManifest(former, { items: [{ kind: 'still', screen: '/', device: 'desktop', file: join(former, 'evidence', 'shot.png'), tree: 't' }] });
  git(repo, 'branch', '-m', 'redesign/payment-screen');
  const renamed = currentDir();
  assert.equal(renamed, join(branchesRoot(), 'redesign__payment-screen'));
  assert.equal(approvePlan(renamed).status, 'approved');
  assert.equal(existsSync(former), false);
  assert.equal(readManifest(renamed).items[0].file, join(renamed, 'evidence', 'shot.png'));
});

test('a rename of a rename still finds the plan', () => {
  git(repo, 'checkout', '-q', '-b', 'first');
  writePlan(currentDir(), PLAN);
  git(repo, 'branch', '-m', 'second');
  git(repo, 'branch', '-m', 'third');
  assert.equal(readPlan(currentDir()).status, 'draft');
});

test('a former name that is a live branch again keeps its plan', () => {
  git(repo, 'checkout', '-q', '-b', 'placeholder');
  writePlan(currentDir(), PLAN);
  git(repo, 'branch', '-m', 'feat/renamed');
  git(repo, 'branch', 'placeholder');
  assert.equal(readPlan(currentDir()).status, 'missing');
  assert.equal(readPlan(join(branchesRoot(), 'placeholder')).status, 'draft');
});

test('a deleted branch does not hand its approved plan to a new one', () => {
  git(repo, 'checkout', '-q', '-b', 'old-work');
  writePlan(currentDir(), PLAN);
  approvePlan(currentDir());
  git(repo, 'checkout', '-q', '-b', 'new-work');
  git(repo, 'branch', '-D', 'old-work');
  assert.equal(readPlan(currentDir()).status, 'missing');
  assert.equal(readPlan(join(branchesRoot(), 'old-work')).status, 'approved');
});

test('worktrees share one project id, and a rename in one leaves the others alone', () => {
  const other = join(root, 'wild-bumblebee');
  git(repo, 'worktree', 'add', '-q', '-b', 'feat/other', other);
  assert.equal(locateProject(other).id, locateProject(repo).id);
  writePlan(currentDir(other), PLAN);
  git(repo, 'checkout', '-q', '-b', 'mine');
  writePlan(currentDir(), PLAN.replace('returns one', 'returns two'));
  git(repo, 'branch', '-m', 'mine-renamed');
  assert.match(readPlan(currentDir()).text, /returns two/);
  assert.match(readPlan(currentDir(other)).text, /returns one/);
});

test('branch state under a worktree-named id (up to v0.3.5) moves to the repository id, without overwriting', () => {
  const worktree = join(root, 'harsh-pony');
  git(repo, 'worktree', 'add', '-q', '-b', 'legacy/branch', worktree);
  const legacy = localRulesDir(legacyProjectId(worktree, commonDir()));
  mkdirSync(join(legacy, 'branches', 'legacy__branch'), { recursive: true });
  mkdirSync(join(legacy, 'branches', 'feat__other'), { recursive: true });
  writeFileSync(join(legacy, 'branches', 'legacy__branch', 'plan.md'), `${PLAN}\n`);
  writeFileSync(join(legacy, 'branches', 'feat__other', 'plan.md'), 'not the live one\n');
  const id = projectId(commonDir());
  assert.equal(locateProject(worktree).id, id);
  assert.equal(readPlan(currentDir(worktree)).status, 'draft');
  assert.match(readPlan(join(localRulesDir(id), 'branches', 'feat__other')).text, /returns one/);
  assert.equal(readFileSync(join(legacy, 'branches', 'feat__other', 'plan.md'), 'utf8'), 'not the live one\n');
});

test('a local ruleset set up in one worktree moves whole, with its acceptance', () => {
  const worktree = join(root, 'i18n-seo');
  git(repo, 'worktree', 'add', '-q', '-b', 'feat/seo', worktree);
  const legacyId = legacyProjectId(worktree, commonDir());
  const id = projectId(commonDir());
  rmSync(localRulesDir(id), { recursive: true, force: true });
  mkdirSync(localRulesDir(legacyId), { recursive: true });
  writeFileSync(join(localRulesDir(legacyId), 'config.json'), '{"status":"active"}\n');
  mkdirSync(join(home, 'accepted'), { recursive: true });
  writeFileSync(recordPath(legacyId), '{"reguaHash":"h"}\n');
  const project = locateProject(worktree);
  assert.equal(project.mode, 'local');
  assert.equal(project.rulesDir, localRulesDir(id));
  assert.equal(locateProject(repo).mode, 'local');
  assert.equal(readFileSync(recordPath(id), 'utf8'), '{"reguaHash":"h"}\n');
  assert.equal(existsSync(localRulesDir(legacyId)), false);
});

test('the main checkout keeps the id it had before', () => {
  assert.equal(locateProject(repo).id, legacyProjectId(repo, commonDir()));
});

test('in team mode each worktree keeps its own acceptance, under the id it had', () => {
  const worktree = join(root, 'team-tree');
  git(repo, 'worktree', 'add', '-q', '-b', 'feat/team', worktree);
  mkdirSync(join(worktree, '.quality'));
  writeFileSync(join(worktree, '.quality', 'config.json'), '{}\n');
  const project = locateProject(worktree);
  assert.equal(project.mode, 'team');
  assert.equal(project.id, projectId(commonDir()));
  assert.equal(project.acceptanceId, legacyProjectId(worktree, commonDir()));
});
