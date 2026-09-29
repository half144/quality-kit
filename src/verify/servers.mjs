/**
 * Starts the app verify opens, with the ruleset's command
 * (`verify.apps[].start`): `{port}` becomes a free port requested from the OS.
 * The `build`, if any, runs first. The env comes from `env` and from a file
 * (`envFile`, `~` allowed), so it can point at a real backend without putting
 * secrets in the ruleset.
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
  if (file && !existsSync(file)) throw new Error(`verify needs the env file ${file}, which does not exist on this machine.`);
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
    if (child.exitCode !== null) throw new Error(`The server for ${url} exited with ${child.exitCode}.`);
    const ready = await fetch(url, { redirect: 'manual' }).then(() => true, () => false);
    if (ready) return;
    await new Promise((resume) => setTimeout(resume, 500));
  }
  throw new Error(`${url} did not respond within ${timeout / 1000} s.`);
}

/** Kills the whole process group: `npm run dev` leaves the real server as a grandchild. */
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
    if (status !== 0) throw new Error(`The build for ${app.name} failed; see ${join(dir, `${app.name}-build.log`)}.`);
  }
  const port = await freePort();
  const child = shell(withPort(app.start.command, port), { cwd, env: { ...env, PORT: String(port) }, log: join(dir, `${app.name}-server.log`) });
  const origin = `http://127.0.0.1:${port}`;
  await waitForHttp(origin + (app.start.readyPath ?? '/'), child, app.start.readyTimeoutMs ?? READY_TIMEOUT_MS);
  return { origin, stop: () => stopGroup(child) };
}
