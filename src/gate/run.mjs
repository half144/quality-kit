/** Roda um comando sem travar os outros; `output` junta as duas saídas na ordem em que chegam. */

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

/** Um título e uma lista, ou null se a lista está vazia. */
export function listing(title, items) {
  return items.length === 0 ? null : `${title}:\n${items.map((item) => `  ${item}`).join('\n')}`;
}
