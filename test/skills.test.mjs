// The skills as shipped: frontmatter that parses, links that resolve, and the
// task router pointing only at playbooks that exist.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const SKILLS = join(import.meta.dirname, '..', 'skills');
const PLAYBOOKS = ['bug-fix', 'feature', 'refactor', 'perf', 'investigation'];

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** The frontmatter's `key: value` lines; a quoted value must be a valid double-quoted string. */
function frontmatter(text) {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(block, 'no frontmatter');
  return Object.fromEntries(block[1].split('\n').map((line) => {
    const [, key, value] = /^([\w-]+): (.+)$/.exec(line) ?? assert.fail(`not a key: value line: ${line}`);
    return [key, value.startsWith('"') ? JSON.parse(value) : value];
  }));
}

test('every skill has a frontmatter that parses, named after its folder', () => {
  for (const name of readdirSync(SKILLS)) {
    const meta = frontmatter(readFileSync(join(SKILLS, name, 'SKILL.md'), 'utf8'));
    assert.equal(meta.name, name);
    assert.ok(meta.description, `${name}: no description`);
  }
});

test('the playbooks are references of task, not skills', () => {
  for (const playbook of PLAYBOOKS) {
    assert.ok(!existsSync(join(SKILLS, playbook)), `${playbook} is still a skill`);
    assert.ok(existsSync(join(SKILLS, 'task', 'references', `${playbook}.md`)), `${playbook} has no reference`);
  }
  const task = readFileSync(join(SKILLS, 'task', 'SKILL.md'), 'utf8');
  for (const playbook of PLAYBOOKS) assert.match(task, new RegExp(`\\(references/${playbook}\\.md\\)`));
});

test('every relative link in the skills resolves', () => {
  for (const file of markdownFiles(SKILLS)) {
    for (const [, target] of readFileSync(file, 'utf8').matchAll(/\]\(([^)#\s]+)\)/g)) {
      if (/^[a-z]+:/.test(target)) continue;
      assert.ok(existsSync(join(dirname(file), target)), `${file}: ${target}`);
    }
  }
});
