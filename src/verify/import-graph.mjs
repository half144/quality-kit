/**
 * Who imports whom inside an app's `src`, read from the file text. Used to
 * find the screens of a shared file: walks up the importers until it reaches a
 * feature in the map or a screen.
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

/** Walks up the importers of `file` and returns the first ones `isOwner` recognizes. */
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
