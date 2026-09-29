/** Nomes de arquivo e de pasta: o que conta como teste, código e cada convenção. */

import path from 'node:path';

const CONVENTIONS = {
  kebab: /^[a-z0-9]+(-[a-z0-9]+)*$/,
  camel: /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/,
  pascal: /^[A-Z][a-zA-Z0-9]*$/,
};

/** Casa com a convenção? `any` (ou ausente) aceita tudo. */
export function follows(convention, name) {
  const pattern = CONVENTIONS[convention];
  return !pattern || pattern.test(name);
}

/**
 * Nome sem a extensão e sem os sufixos de convenção: `.test`, `.spec`,
 * `.dom.test`, plataforma (`.web`, `.native`...), `.styles`, `.module`, `.d`
 * e a densidade de imagem (`@2x`).
 */
export function baseName(file) {
  return path.posix
    .basename(file)
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/@[23]x$/, '')
    .replace(/\.(d|module)$/, '')
    .replace(/\.(dom\.)?(test|spec)$/, '')
    .replace(/\.(web|native|ios|android)$/, '')
    .replace(/\.(styles|stories)$/, '');
}

export function isTest(file) {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(file);
}

export function isIndex(file) {
  return /^index\.[cm]?[jt]sx?$/.test(path.posix.basename(file));
}

export function isCode(file) {
  return /\.[cm]?[jt]sx?$/.test(file) && !file.endsWith('.d.ts');
}

export function isComponentFile(file) {
  return /\.[jt]sx$/.test(file);
}
