/** Runs a command without blocking the others; `output` merges both streams in arrival order. */

import { spawn } from 'node:child_process';

export function run(command, args, { cwd, env = {}, shell = false } = {}) {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, shell, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', (error) => done({ status: 1, stdout, output: String(error) }));
    child.on('close', (status) => done({ status, stdout, output }));
  });
}

/** A title and a list, or null if the list is empty. */
export function listing(title, items) {
  return items.length === 0 ? null : `${title}:\n${items.map((item) => `  ${item}`).join('\n')}`;
}
