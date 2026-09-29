/**
 * Quem importa quem dentro do `src` de um app, lido do texto dos arquivos.
 * Serve para achar as telas de um arquivo compartilhado: sobe pelos
 * importadores até chegar numa feature do mapa ou numa tela.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

import { importSpecifiers } from '../architecture/imports.mjs';

const EXTENSIONS = ['', '.ts', '.tsx', '.web.ts', '.web.tsx', '.js', '.jsx', '.mjs', '.css', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
const NOT_PRODUCTION = /\.(test|spec)\.|\/__tests__\/|\/__mocks__\/|\/testing\//;

export function resolveImport(from, specifier, srcRoot, exists) {
  let base;
  if (specifier.startsWith('@/')) base = join(srcRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) base = join(dirname(from), specifier);
  else return [];
  const normalized = normalize(base);
  return EXTENSIONS.map((extension) => normalized + extension).filter(exists);
}

export function importersOf(files, { srcRoot, read }) {
  const known = new Set(files);
  const importers = new Map();
  for (const file of files.filter((path) => !NOT_PRODUCTION.test(path))) {
    for (const specifier of importSpecifiers(read(file))) {
      for (const target of resolveImport(file, specifier, srcRoot, (path) => known.has(path))) importers.set(target, [...(importers.get(target) ?? []), file]);
    }
  }
  return importers;
}

/** Sobe pelos importadores de `file` e devolve os primeiros que `isOwner` reconhece. */
export function owningImporters(file, importers, isOwner) {
  const owners = new Set();
  const seen = new Set([file]);
  const queue = [file];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const importer of importers.get(current) ?? []) {
      if (seen.has(importer)) continue;
      seen.add(importer);
      if (isOwner(importer)) owners.add(importer);
      else queue.push(importer);
    }
  }
  return [...owners];
}

export function appImporters(repo, srcRoot, files) {
  return importersOf(
    files.filter((path) => path.startsWith(srcRoot) && /\.([cm]?[jt]sx?|css)$/.test(path)),
    { srcRoot, read: (path) => readFileSync(join(repo, path), 'utf8') },
  );
}
