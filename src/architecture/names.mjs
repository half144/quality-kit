/** File and folder names: what counts as a test, as code, and each naming convention. */

import path from 'node:path';

const CONVENTIONS = {
  kebab: /^[a-z0-9]+(-[a-z0-9]+)*$/,
  camel: /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/,
  pascal: /^[A-Z][a-zA-Z0-9]*$/,
};

/** Does the name follow the convention? `any` (or none) accepts everything. */
export function follows(convention, name) {
  const pattern = CONVENTIONS[convention];
  return !pattern || pattern.test(name);
}

/**
 * The name without the extension and the conventional suffixes: `.test`,
 * `.spec`, `.dom.test`, platform (`.web`, `.native`...), `.styles`, `.module`,
 * `.d` and the image density (`@2x`).
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
