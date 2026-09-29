/**
 * Servidor de SPA para o verify (`quality-kit serve <pasta> --port <n>`): o
 * export estático de um app (ex.: `expo export -p web`). Arquivo que existe
 * sai como está; caminho de rota (sem extensão) recebe o `index.html`; arquivo
 * que não existe é 404, para o verify pegar o asset quebrado.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

const INDEX = 'index.html';

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

/** O arquivo que responde a um caminho da URL, ou null (404). */
export function fileFor(root, urlPath) {
  // O caminho da URL é absoluto: o normalize não o deixa subir acima de `/`.
  const relative = normalize(decodeURIComponent(urlPath.split('?')[0] ?? '/'));
  const candidate = join(root, relative);
  if (isFile(candidate)) return candidate;
  if (isFile(join(candidate, INDEX))) return join(candidate, INDEX);
  return extname(relative) === '' ? join(root, INDEX) : null;
}

export function createSpaServer(root) {
  return createServer((request, response) => {
    const file = fileFor(root, request.url ?? '/');
    if (!file) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
}
