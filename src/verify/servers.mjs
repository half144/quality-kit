/**
 * Sobe o app que o verify abre, com o comando da régua (`verify.apps[].start`):
 * `{port}` vira uma porta livre pedida ao sistema. O `build`, se houver, roda
 * antes. O env vem de `env` e de um arquivo (`envFile`, com `~`), para apontar
 * para um backend de verdade sem pôr segredo na régua.
 */

import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

const READY_TIMEOUT_MS = 120_000;

export function parseEnv(text) {
  const entries = text
    .split('\n')
    .map((line) => /^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^(['"])(.*)\1$/, '$2')]);
  return Object.fromEntries(entries);
}

export function expandHome(path) {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

export function appEnv(start) {
  const file = start.envFile ? expandHome(start.envFile) : null;
  if (file && !existsSync(file)) throw new Error(`O verify pede o env ${file}, que não existe nesta máquina.`);
  const fromFile = file ? parseEnv(readFileSync(file, 'utf8')) : {};
  const picked = start.envKeys ? Object.fromEntries(start.envKeys.map((key) => [key, fromFile[key]])) : fromFile;
  return { ...picked, ...start.env };
}

export function withPort(command, port) {
  return command.replaceAll('{port}', String(port));
}

export function freePort() {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => done(address.port));
    });
  });
}

function shell(command, { cwd, env, log }) {
  const out = createWriteStream(log);
  const child = spawn(command, { cwd, env: { ...process.env, ...env }, shell: true, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  return child;
}

function finished(child) {
  return new Promise((done) => {
    child.on('error', () => done(1));
    child.on('close', (status) => done(status ?? 1));
  });
}

async function waitForHttp(url, child, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`O servidor de ${url} saiu com ${child.exitCode}.`);
    const ready = await fetch(url, { redirect: 'manual' }).then(() => true, () => false);
    if (ready) return;
    await new Promise((resume) => setTimeout(resume, 500));
  }
  throw new Error(`${url} não respondeu em ${timeout / 1000} s.`);
}

/** Mata o grupo inteiro: `npm run dev` deixa o servidor de verdade como neto. */
function stopGroup(child) {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill();
  }
}

export async function startApp({ repo, dir, app }) {
  const cwd = join(repo, app.start.cwd ?? '');
  const env = appEnv(app.start);
  if (app.start.build) {
    const status = await finished(shell(app.start.build, { cwd, env, log: join(dir, `${app.name}-build.log`) }));
    if (status !== 0) throw new Error(`O build de ${app.name} falhou; veja ${join(dir, `${app.name}-build.log`)}.`);
  }
  const port = await freePort();
  const child = shell(withPort(app.start.command, port), { cwd, env: { ...env, PORT: String(port) }, log: join(dir, `${app.name}-server.log`) });
  const origin = `http://127.0.0.1:${port}`;
  await waitForHttp(origin + (app.start.readyPath ?? '/'), child, app.start.readyTimeoutMs ?? READY_TIMEOUT_MS);
  return { origin, stop: () => stopGroup(child) };
}
