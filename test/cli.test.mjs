import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { commandHelp } from '../src/cli.mjs';

const BIN = join(import.meta.dirname, '..', 'bin', 'quality-kit.mjs');

test('help: a command with its own usage, one from the overview with its option line, an unknown one', () => {
  assert.match(commandHelp('ship'), /quality-kit ship \[--dry-run\] \[--title <text>\] \[--base <branch>\]/);
  assert.match(commandHelp('plan'), /write \[--file <plan\.md>\] \| show \| status \| approve/);
  assert.match(commandHelp('evidence'), /evidence still <path>\.\.\./);
  assert.match(commandHelp('gate'), /^quality-kit gate \[options\].*\n {2}\[--profile full\|fast\]/);
  assert.equal(commandHelp('rules').split('\n').length, 2);
  assert.match(commandHelp('nope'), /^quality-kit <command>/);
});

test('help: --help works outside a git repository and a set-up project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qk-cli-'));
  try {
    for (const args of [['ship', '--help'], ['gate', '-h'], ['evidence', '--help']]) {
      const { status, stdout } = spawnSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: 'utf8' });
      assert.equal(status, 0, args.join(' '));
      assert.match(stdout, new RegExp(`quality-kit ${args[0]}`));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
