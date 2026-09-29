// Ponta a ponta num repo temporário, no modo local: setup, gate reprovando o
// erro do agente, trava de integridade e o repo intocado.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';

const home = mkdtempSync(join(tmpdir(), 'qk-home-'));
const repo = mkdtempSync(join(tmpdir(), 'qk-repo-'));
process.env.QUALITY_KIT_HOME = home;

const { loadConfig } = await import('../src/config.mjs');
const { runGate } = await import('../src/gate/gate.mjs');
const { handleHook } = await import('../src/gate/hook.mjs');
const { locateProject } = await import('../src/project.mjs');
const { finalizeProject, initProject } = await import('../src/setup/init.mjs');

function git(...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function write(file, content) {
  mkdirSync(dirname(join(repo, file)), { recursive: true });
  writeFileSync(join(repo, file), content);
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

test('modo local: o setup não muda nada no repo', () => {
  assert.equal(git('status', '--porcelain'), '');
  assert.equal(locateProject(repo).mode, 'local');
});

test('árvore sem mudança passa', async () => {
  assert.deepEqual(await gate(), []);
});

test('o gate reprova arquivo novo sem teste, any, tipo frouxo e import proibido', async () => {
  write('src/features/pagamento/utils/juros.ts', "import { total } from '@/features/conta/utils/total';\n\nexport function juros(valor: any, taxa) {\n  return total([valor * taxa]);\n}\n");
  const problems = (await gate()).join('\n\n');
  assert.match(problems, /Arquitetura[\s\S]*import-direction[\s\S]*feature "pagamento" importando de "conta"/);
  assert.match(problems, /Arquivo novo com lógica e sem teste ao lado:\n {2}src\/features\/pagamento\/utils\/juros\.ts/);
  assert.match(problems, /no-explicit-any/);
  assert.match(problems, /TS7006/);
  rmSync(join(repo, 'src/features/pagamento'), { recursive: true });
});

test('o hook Stop devolve o relatório para o agente', async () => {
  write('src/lib/nova.ts', 'export function nova(): number {\n  return 1;\n}\n');
  const message = await handleHook({ hook_event_name: 'Stop', cwd: repo });
  assert.match(message, /O quality-kit reprovou a mudança[\s\S]*src\/lib\/nova\.ts/);
  write('src/lib/nova.test.ts', "import { nova } from './nova';\nif (nova() !== 1) throw new Error('nova');\n");
  assert.equal(await handleHook({ hook_event_name: 'Stop', cwd: repo }), null);
  rmSync(join(repo, 'src/lib/nova.ts'));
  rmSync(join(repo, 'src/lib/nova.test.ts'));
});

test('régua alterada reprova antes de qualquer check', async () => {
  const path = join(locateProject(repo).rulesDir, 'config.json');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, JSON.stringify({ ...JSON.parse(original), checks: { lint: false } }, null, 2));
  const problems = await gate();
  assert.equal(problems.length, 1);
  assert.match(problems[0], /A régua foi alterada; mudança de régua é decisão humana: rode `quality-kit rules accept`/);
  writeFileSync(path, original);
  assert.deepEqual(await gate(), []);
});

test('suprimir em massa aparece como dívida que cresceu', async () => {
  const project = locateProject(repo);
  const path = join(project.rulesDir, 'baseline', 'eslint', 'root.json');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, JSON.stringify({ 'src/lib/soma.ts': { 'no-console': { count: 3 } } }));
  const [problem] = await gate();
  assert.match(problem, /A dívida congelada cresceu[\s\S]*eslint:src\/lib\/soma\.ts no-console {2}0 -> 3/);
  writeFileSync(path, original);
});

test('o aceite adulterado não passa', async () => {
  const project = locateProject(repo);
  const record = join(home, 'accepted', `${project.id}.json`);
  const original = readFileSync(record, 'utf8');
  writeFileSync(record, JSON.stringify({ ...JSON.parse(original), reguaHash: 'forjado' }));
  const [problem] = await gate();
  assert.match(problem, /adulterado/);
  writeFileSync(record, original);
});
