import assert from 'node:assert/strict';
import { test } from 'node:test';

import { withDefaults } from '../src/config.mjs';
import { jscpdArgs, knipArgs } from '../src/gate/checks/dead-code.mjs';
import { eslintArgs } from '../src/gate/checks/lint.mjs';
import { hasLogic, isMovedCode, removedLines, testCandidates, untestedFiles } from '../src/gate/checks/tests-alongside.mjs';
import { nodeTestFiles, testCommand } from '../src/gate/checks/tests.mjs';
import { parseTscOutput, tscArgs } from '../src/gate/checks/typecheck.mjs';
import { grownItems, shrinkBaseline } from '../src/gate/debt.mjs';
import { enabledChecks, report } from '../src/gate/gate.mjs';
import { groupByWorkspace } from '../src/gate/groups.mjs';
import { guardReason } from '../src/gate/guard.mjs';
import { protectedPush } from '../src/setup/git-hook.mjs';

const RULES = withDefaults({}).testsAlongside;

test('perfis: fast só estrutura, teste ao lado e dívida; check desligado sai', () => {
  const config = withDefaults({ checks: { knip: false } });
  assert.deepEqual([...enabledChecks(config, 'fast')], ['architecture', 'testsAlongside', 'suppressions']);
  assert.ok(!enabledChecks(config, 'full').has('knip'));
  assert.ok(enabledChecks(config, 'full').has('typecheck'));
});

test('o relatório manda refatorar, não suprimir', () => {
  assert.match(report(['x']), /reprovou a mudança[\s\S]*Refatore o código[\s\S]*x$/);
});

test('arquivos agrupados pelo workspace mais específico', () => {
  const config = withDefaults({ workspaces: [{ dir: '' }, { dir: 'apps/web' }] });
  const groups = groupByWorkspace(config.workspaces, ['apps/web/src/a.ts', 'scripts/b.mjs', 'README.md']);
  assert.deepEqual(groups.map(({ workspace, files }) => [workspace.dir, files]), [['apps/web/', ['src/a.ts']], ['', ['scripts/b.mjs']]]);
});

test('ESLint: config do kit, supressões fora do repo e poda só quando o arquivo existe', () => {
  assert.deepEqual(eslintArgs({ overlay: '/o.mjs', suppressions: '/s.json', suppressionsExist: false, files: ['a.ts'] }), [
    '--config', '/o.mjs', '--suppressions-location', '/s.json', '--max-warnings', '0', '--no-warn-ignored', 'a.ts',
  ]);
  assert.ok(eslintArgs({ overlay: null, suppressions: null, suppressionsExist: true, files: [] }).includes('--prune-suppressions'));
});

test('tsc: flags estritas na linha de comando e saída lida por arquivo', () => {
  assert.deepEqual(tscArgs('tsconfig.json', ['--strict']), ['-p', 'tsconfig.json', '--noEmit', '--pretty', 'false', '--strict']);
  const { errors, global } = parseTscOutput("src/a.ts(3,5): error TS2322: Type 'x'.\nerror TS5023: Unknown compiler option 'y'.\n", '/repo');
  assert.deepEqual(errors, [{ file: 'src/a.ts', line: 3, column: 5, code: 'TS2322', message: "Type 'x'." }]);
  assert.deepEqual(global, ["error TS5023: Unknown compiler option 'y'."]);
});

test('dívida por arquivo: erro novo reprova, antigo não; a baseline encolhe e nunca cresce', () => {
  const error = (file, code) => ({ file, code });
  const baseline = { 'a.ts': { TS1: 1 } };
  const touched = new Set(['a.ts', 'b.ts']);
  assert.deepEqual(grownItems([error('a.ts', 'TS1')], baseline, touched), []);
  assert.equal(grownItems([error('a.ts', 'TS1'), error('a.ts', 'TS1')], baseline, touched).length, 2);
  assert.equal(grownItems([error('b.ts', 'TS1')], baseline, touched).length, 1);
  assert.deepEqual(grownItems([error('c.ts', 'TS1')], baseline, touched), []);
  assert.deepEqual(shrinkBaseline(baseline, [], touched), {});
  assert.deepEqual(shrinkBaseline({ 'a.ts': { TS1: 2 } }, [error('a.ts', 'TS1')], touched), { 'a.ts': { TS1: 1 } });
});

test('teste ao lado: arquivo novo com função precisa de teste; tipo, dado e código movido não', () => {
  const sources = {
    'src/soma.ts': 'export function soma(a: number, b: number) { return a + b; }',
    'src/tipos.ts': 'export type A = { b: string };\nexport const X = 1;',
    'src/testado.ts': 'export const f = () => 1;',
    'src/testado.test.ts': '',
    'src/card.tsx': 'export function Card() { return null; }',
  };
  const untested = untestedFiles(Object.keys(sources), { rules: RULES, exists: (path) => path in sources, read: (path) => sources[path] });
  assert.deepEqual(untested, ['src/soma.ts']);
  assert.ok(!hasLogic('export type F = (a: number) => number;', 'x.ts'));
});

test('teste ao lado: código extraído de outro arquivo no mesmo diff não conta como novo', () => {
  const moved = 'export function calculaTotalDoCarrinho(itens) {\n  return itens.reduce((total, item) => total + item.preco, 0);\n}';
  const diff = `--- a/src/velho.ts\n+++ b/src/velho.ts\n${moved.split('\n').map((line) => `-${line}`).join('\n')}`;
  assert.ok(isMovedCode(moved, removedLines(diff)));
  assert.ok(!isMovedCode(moved, new Set()));
});

test('teste ao lado: pastas de teste da régua (ex.: __tests__)', () => {
  const rules = { ...RULES, testDirs: ['{dir}', 'src/__tests__'] };
  assert.ok(testCandidates('src/hooks/use-chat.ts', rules).includes('src/__tests__/use-chat.test.ts'));
  assert.ok(testCandidates('src/share.web.ts', RULES).includes('src/share.test.ts'));
});

test('testes ligados: comando por runner', () => {
  const exists = () => true;
  const workspace = (test) => ({ dir: '', test });
  assert.deepEqual(testCommand({ repo: '/r', workspace: workspace('vitest'), files: ['a.ts'], exists }).args, ['related', '--run', '--passWithNoTests', 'a.ts']);
  assert.deepEqual(testCommand({ repo: '/r', workspace: workspace('jest'), files: ['a.ts'], exists }).args, ['--findRelatedTests', 'a.ts', '--passWithNoTests']);
  assert.equal(testCommand({ repo: '/r', workspace: workspace('none'), files: ['a.ts'], exists }), null);
  assert.deepEqual(testCommand({ repo: '/r', workspace: workspace({ command: 'bun', args: ['test', '{files}'] }), files: ['a.ts'], exists }), { bin: 'bun', args: ['test', 'a.ts'] });
  assert.deepEqual(nodeTestFiles(['scripts/a.mjs', 'scripts/b.test.mjs'], (path) => path === 'scripts/a.test.mjs'), ['scripts/b.test.mjs', 'scripts/a.test.mjs']);
});

test('knip e jscpd: argumentos', () => {
  assert.deepEqual(knipArgs({ production: true, configPath: '/k.json' }), ['--production', '--config', '/k.json', '--reporter', 'json', '--no-exit-code', '--no-progress']);
  const config = withDefaults({});
  const args = jscpdArgs({ base: 'abc', output: '/tmp/o', config, hasProjectConfig: false });
  assert.deepEqual(args.slice(0, 2), ['--baseline-from-ref', 'abc']);
  assert.ok(args.includes('src'));
  assert.ok(!jscpdArgs({ base: 'abc', output: '/tmp/o', config, hasProjectConfig: true }).includes('--min-tokens'));
});

test('guarda: o agente não mexe no kit, na chave nem aceita a régua', () => {
  const paths = ['/home/.quality-kit/key', '/home/.quality-kit/accepted', '/kit'];
  const reason = (input, active = true) => guardReason(input, { paths, active });
  assert.match(reason({ tool_name: 'Edit', tool_input: { file_path: '/kit/src/lint/preset.cjs' } }), /trava do quality-kit/);
  assert.match(reason({ tool_name: 'Write', tool_input: { file_path: '/home/.quality-kit/accepted/x.json' } }), /trava/);
  assert.equal(reason({ tool_name: 'Edit', tool_input: { file_path: '/repo/src/a.ts' } }), null);
  assert.match(reason({ tool_name: 'Bash', tool_input: { command: 'quality-kit rules accept' } }), /só para humano/);
  assert.match(reason({ tool_name: 'Bash', tool_input: { command: 'npx eslint . --suppress-all' } }), /suprimir/);
  assert.match(reason({ tool_name: 'Bash', tool_input: { command: 'git push --no-verify' } }), /pular/);
  assert.equal(reason({ tool_name: 'Bash', tool_input: { command: 'git push --no-verify' } }, false), null);
  assert.match(reason({ tool_name: 'Bash', tool_input: { command: 'quality-kit rules accept' } }, false), /só para humano/);
  assert.equal(reason({ tool_name: 'Bash', tool_input: { command: 'npm test' } }), null);
});

test('pre-push: push direto em branch protegida', () => {
  assert.equal(protectedPush('refs/heads/x abc refs/heads/main def\n', ['main']), 'refs/heads/main');
  assert.equal(protectedPush('refs/heads/x abc refs/heads/feat def\n', ['main']), null);
});
