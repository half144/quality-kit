// End to end in a temporary repo, in local mode: setup, the gate failing the
// agent's mistakes, the integrity lock and an untouched repo.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';

const BIN = join(import.meta.dirname, '..', 'bin', 'quality-kit.mjs');
const home = mkdtempSync(join(tmpdir(), 'qk-home-'));
const repo = mkdtempSync(join(tmpdir(), 'qk-repo-'));
process.env.QUALITY_KIT_HOME = home;

const { loadConfig } = await import('../src/config.mjs');
const { runGate } = await import('../src/gate/gate.mjs');
const { handleHook } = await import('../src/gate/hook.mjs');
const { branchDir } = await import('../src/branch/state.mjs');
const { AWAITING_NOTICE, branchPlanState, changesFingerprint } = await import('../src/plan/plan-check.mjs');
const { approvePlan, writePlan } = await import('../src/plan/store.mjs');
const { locateProject } = await import('../src/project.mjs');
const { finalizeProject, initProject } = await import('../src/setup/init.mjs');

function git(...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function write(file, content) {
  mkdirSync(dirname(join(repo, file)), { recursive: true });
  writeFileSync(join(repo, file), content);
}

/** What the Stop hook tells Claude Code: `{ block }`, `{ notice }` or null. */
function stop() {
  return handleHook({ hook_event_name: 'Stop', cwd: repo });
}

async function gate() {
  const project = locateProject(repo);
  return runGate({ project, config: loadConfig(project.rulesDir) });
}

before(async () => {
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  write('package.json', JSON.stringify({ name: 'demo', private: true, type: 'module' }));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', noEmit: true }, include: ['src'] }));
  write('src/lib/soma.ts', 'export function soma(a: number, b: number): number {\n  return a + b;\n}\n');
  write('src/lib/soma.test.ts', "import { soma } from './soma';\nif (soma(1, 1) !== 2) throw new Error('soma');\n");
  write('src/features/conta/utils/total.ts', "import { soma } from '../../../lib/soma';\n\nexport function total(valores: number[]): number {\n  return valores.reduce(soma, 0);\n}\n");
  write('src/features/conta/utils/total.test.ts', "import { total } from './total';\nif (total([1]) !== 1) throw new Error('total');\n");
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  git('checkout', '-q', '-b', 'trabalho');
  initProject(repo, { mode: 'local', architecture: 'suggest', base: 'main' });
  const config = JSON.parse(readFileSync(join(locateProject(repo).rulesDir, 'config.json'), 'utf8'));
  writeFileSync(join(locateProject(repo).rulesDir, 'config.json'), JSON.stringify({ ...config, checks: { knip: false, jscpd: false, verify: false, tests: false } }, null, 2));
  await finalizeProject(repo);
});

after(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

test('local mode: setup changes nothing in the repo', () => {
  assert.equal(git('status', '--porcelain'), '');
  assert.equal(locateProject(repo).mode, 'local');
});

test('an unchanged tree passes', async () => {
  assert.deepEqual(await gate(), []);
});

test('the gate fails a new file without a test, any, a loose type and a forbidden import', async () => {
  write('src/features/pagamento/utils/juros.ts', "import { total } from '@/features/conta/utils/total';\n\nexport function juros(valor: any, taxa) {\n  return total([valor * taxa]);\n}\n");
  const problems = (await gate()).join('\n\n');
  assert.match(problems, /Architecture[\s\S]*import-direction[\s\S]*"pagamento"[\s\S]*"conta"/);
  assert.match(problems, /New file with logic and no test next to it:\n {2}src\/features\/pagamento\/utils\/juros\.ts/);
  assert.match(problems, /no-explicit-any/);
  assert.match(problems, /TS7006/);
  rmSync(join(repo, 'src/features/pagamento'), { recursive: true });
});

const PLAN = 'Goal: a helper for new numbers\nContext: none exists\nWhere:\n- src/lib/nova.ts\nHow it works: returns one\nProof: its unit test';

test('the Stop hook asks for the owner-approved tiny plan once the branch changes code; git and CI do not', async () => {
  write('src/lib/um.ts', 'export function um(): number {\n  return 1;\n}\n');
  write('src/lib/um.test.ts', "import { um } from './um';\nif (um() !== 1) throw new Error('um');\n");
  const dir = branchDir(locateProject(repo));
  assert.match((await stop()).block, /write a tiny plan with the tiny-plan skill and get the owner's ok/);
  assert.deepEqual(await gate(), []);
  writePlan(dir, PLAN);
  assert.match((await stop()).block, /not approved/);
  approvePlan(dir);
  assert.equal(await stop(), null);
  writePlan(dir, PLAN.replace('one', 'two'));
  assert.match((await stop()).block, /changed after the owner approved/);
  writePlan(dir, PLAN);
  assert.equal(await stop(), null);
  rmSync(join(repo, 'src/lib/um.ts'));
  rmSync(join(repo, 'src/lib/um.test.ts'));
});

test('a plan saved and waiting for the ok lets the turn end, until the code moves again', async () => {
  write('src/lib/tres.ts', 'export const tres = 3;\n');
  const project = locateProject(repo);
  const config = loadConfig(project.rulesDir);
  const dir = branchDir(project);
  writePlan(dir, PLAN.replace('one', 'three'), changesFingerprint(project, config));
  assert.deepEqual(await stop(), { notice: AWAITING_NOTICE });
  assert.equal(await handleHook({ hook_event_name: 'SubagentStop', cwd: repo, agent_id: 'a1' }), null);
  write('src/lib/tres.ts', 'export const tres = 4;\n');
  assert.match((await stop()).block, /code changed after the plan was saved/);
  writePlan(dir, PLAN, changesFingerprint(project, config));
  assert.equal(branchPlanState(project, config).awaiting, false);
  rmSync(join(repo, 'src/lib/tres.ts'));
});

test('waiting for the ok, the Stop hook exits 0 and shows the owner a notice', () => {
  const project = locateProject(repo);
  const dir = branchDir(project);
  writePlan(dir, PLAN.replace('one', 'four'), changesFingerprint(project, loadConfig(project.rulesDir)));
  const hook = spawnSync(process.execPath, [BIN, 'hook'], { input: JSON.stringify({ hook_event_name: 'Stop', cwd: repo }), encoding: 'utf8' });
  assert.equal(hook.status, 0);
  assert.deepEqual(JSON.parse(hook.stdout), { systemMessage: 'quality-kit: waiting for your ok on the plan (quality-kit plan show)' });
  assert.equal(hook.stderr, '');
  writePlan(dir, PLAN);
});

test('requirePlan: false turns the plan rule off', async () => {
  write('src/lib/dois.ts', 'export const dois = 2;\n');
  const project = locateProject(repo);
  rmSync(join(branchDir(project), 'approval.json'));
  assert.match(branchPlanState(project, loadConfig(project.rulesDir)).problem, /not approved/);
  assert.equal(branchPlanState(project, { ...loadConfig(project.rulesDir), requirePlan: false }).problem, null);
  approvePlan(branchDir(project));
  rmSync(join(repo, 'src/lib/dois.ts'));
});

test('the Stop hook hands the report back to the agent', async () => {
  write('src/lib/nova.ts', 'export function nova(): number {\n  return 1;\n}\n');
  assert.match((await stop()).block, /quality-kit failed this change[\s\S]*src\/lib\/nova\.ts/);
  write('src/lib/nova.test.ts', "import { nova } from './nova';\nif (nova() !== 1) throw new Error('nova');\n");
  assert.equal(await stop(), null);
  rmSync(join(repo, 'src/lib/nova.ts'));
  rmSync(join(repo, 'src/lib/nova.test.ts'));
});

test('a changed ruleset fails before any check', async () => {
  const path = join(locateProject(repo).rulesDir, 'config.json');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, JSON.stringify({ ...JSON.parse(original), checks: { lint: false } }, null, 2));
  const problems = await gate();
  assert.equal(problems.length, 1);
  assert.match(problems[0], /The ruleset was changed; ruleset changes are a human decision: run `quality-kit rules accept`/);
  writeFileSync(path, original);
  assert.deepEqual(await gate(), []);
});

test('bulk suppression shows up as grown debt', async () => {
  const project = locateProject(repo);
  const path = join(project.rulesDir, 'baseline', 'eslint', 'root.json');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, JSON.stringify({ 'src/lib/soma.ts': { 'no-console': { count: 3 } } }));
  const [problem] = await gate();
  assert.match(problem, /The frozen debt grew[\s\S]*eslint:src\/lib\/soma\.ts no-console {2}0 -> 3/);
  writeFileSync(path, original);
});

test('a tampered acceptance does not pass', async () => {
  const project = locateProject(repo);
  const record = join(home, 'accepted', `${project.id}.json`);
  const original = readFileSync(record, 'utf8');
  writeFileSync(record, JSON.stringify({ ...JSON.parse(original), reguaHash: 'forjado' }));
  const [problem] = await gate();
  assert.match(problem, /tampered/);
  writeFileSync(record, original);
});
