/** Only the tests related to the touched files, with the runner the workspace uses. */

import { existsSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

import { projectBin } from '../bins.mjs';
import { run } from '../run.mjs';

const TEST_OUTPUT_TAIL = 6000;
const IS_TEST = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** Tests for the `node --test` runner: the touched ones and those next to a touched file. */
export function nodeTestFiles(files, exists) {
  const siblings = files
    .filter((file) => !IS_TEST.test(file))
    .flatMap((file) => ['.test', '.spec'].map((suffix) => join(dirname(file), `${basename(file, extname(file))}${suffix}${extname(file)}`)))
    .filter(exists);
  return [...new Set([...files.filter((file) => IS_TEST.test(file)), ...siblings])];
}

/** The command that runs the tests related to the files, or null if there is nothing to run. */
export function testCommand({ repo, workspace, files, exists = existsSync }) {
  const { test } = workspace;
  const cwd = join(repo, workspace.dir);
  if (test === 'vitest') return { bin: projectBin(repo, workspace.dir, 'vitest', exists), args: ['related', '--run', '--passWithNoTests', ...files] };
  if (test === 'jest') return { bin: projectBin(repo, workspace.dir, 'jest', exists), args: ['--findRelatedTests', ...files, '--passWithNoTests'] };
  if (test === 'node') {
    const tests = nodeTestFiles(files, (file) => exists(join(cwd, file)));
    return tests.length === 0 ? null : { bin: process.execPath, args: ['--test', ...tests] };
  }
  if (test && typeof test === 'object') {
    const args = test.args.flatMap((arg) => (arg === '{files}' ? files : [arg]));
    return { bin: test.command, args };
  }
  return null;
}

export async function testsProblem({ project }, { workspace, files }) {
  const command = testCommand({ repo: project.repo, workspace, files });
  if (!command) return null;
  if (!command.bin) return `Tests in ${workspace.dir || 'root'}: the ${workspace.test} runner is not installed in the project (install its dependencies).`;
  const { status, output } = await run(command.bin, command.args, { cwd: join(project.repo, workspace.dir) });
  return status === 0 ? null : `Tests in ${workspace.dir || 'root'}:\n${output.slice(-TEST_OUTPUT_TAIL)}`;
}
