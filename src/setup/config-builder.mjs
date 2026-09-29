/**
 * The ruleset config, built from what `detect` read and the answers to the
 * `setup` skill. "Keep" freezes the shape the code already has (what exists
 * passes, and the debt goes into the baseline); "suggest" proposes the
 * feature-based layout (today's violations also go into the baseline, and new
 * code is born in it).
 */

import { DEFAULT_TS_FLAGS } from '../config.mjs';

export const FEATURE_LAYERS = ['api', 'assets', 'components', 'content', 'hooks', 'stores', 'types', 'utils'];
const SUGGESTED_TOP = ['assets', 'components', 'config', 'features', 'hooks', 'lib', 'stores', 'testing', 'types', 'utils'];
const MIN_FOLDER_SIZE = 10;

function routesName(pkg) {
  return pkg.routes ? pkg.routes.dir.slice(pkg.src.length + 1) : null;
}

function keptRoot(pkg) {
  const { shape } = pkg;
  return {
    path: pkg.src,
    kind: 'app',
    allowedTop: shape.topFolders,
    rootFiles: shape.rootFiles,
    naming: shape.naming,
    noBarrel: shape.barrels === 0,
    testsColocated: shape.testsInFolder === 0,
    routes: pkg.routes && pkg.routes.dir.startsWith(`${pkg.src}/`) ? { dir: routesName(pkg), framework: pkg.routes.framework } : null,
    features: shape.hasFeatures ? { dir: 'features', layers: FEATURE_LAYERS } : null,
  };
}

function suggestedRoot(pkg) {
  const routes = pkg.routes && pkg.routes.dir.startsWith(`${pkg.src}/`) ? { dir: routesName(pkg), framework: pkg.routes.framework } : null;
  return {
    path: pkg.src,
    kind: 'app',
    allowedTop: [...(routes ? [routes.dir] : []), ...SUGGESTED_TOP],
    rootFiles: pkg.shape.rootFiles,
    naming: { files: 'kebab', components: 'kebab', folders: 'kebab' },
    noBarrel: true,
    testsColocated: true,
    routes,
    features: { dir: 'features', layers: FEATURE_LAYERS },
  };
}

function rootsOf(packages, style) {
  return packages.flatMap((pkg) => {
    const roots = [];
    if (pkg.src && pkg.shape) roots.push(style === 'suggest' ? suggestedRoot(pkg) : keptRoot(pkg));
    if (pkg.convexDir) roots.push({ path: pkg.convexDir, kind: 'convex' });
    return roots;
  });
}

function folderSizeOf(packages, roots, style) {
  const largest = Math.max(0, ...packages.map((pkg) => pkg.shape?.largestFolder ?? 0));
  const routeDirs = packages.filter((pkg) => pkg.routes).map((pkg) => `${pkg.routes.dir}{,/**}`);
  return {
    max: style === 'suggest' ? MIN_FOLDER_SIZE : Math.max(MIN_FOLDER_SIZE, largest),
    scopes: roots.map((root) => `${root.path}/**`),
    exempt: ['**/_generated{,/**}', ...routeDirs, ...roots.filter((root) => root.kind === 'convex').map((root) => root.path)],
  };
}

function appName(pkg, taken) {
  const kind = pkg.stack.expo ? 'expo' : 'web';
  const name = taken.has(kind) ? (pkg.dir.split('/').at(-1) || kind) : kind;
  taken.add(name);
  return name;
}

export function defaultStart(pkg) {
  const cwd = pkg.dir;
  if (pkg.stack.next) return { cwd, build: 'npx next build', command: 'npx next start -p {port} -H 127.0.0.1' };
  if (pkg.stack.expo) return { cwd, command: 'npx expo start --web --port {port}' };
  return { cwd, command: 'npx vite --port {port} --strictPort --host 127.0.0.1' };
}

function hasUi(pkg) {
  return pkg.src && (pkg.stack.next || pkg.stack.expo || (pkg.stack.vite && pkg.stack.react));
}

function verifyApps(packages, answers, style) {
  const taken = new Set();
  return packages.filter(hasUi).map((pkg) => {
    const answer = answers.apps?.[pkg.dir || 'root'] ?? {};
    return {
      name: answer.name ?? appName(pkg, taken),
      src: pkg.src,
      routes: pkg.routes,
      featuresDir: pkg.shape?.hasFeatures || style === 'suggest' ? `${pkg.src}/features` : null,
      start: { ...defaultStart(pkg), ...answer.start },
    };
  });
}

function protectedGlobs(mode) {
  const lint = ['**/eslint.config.*', '**/tsconfig*.json', 'knip.json', 'knip.jsonc', '.jscpd.json'];
  return mode === 'team' ? [...lint, '.githooks/**', '.github/workflows/quality.yml', '.claude/settings.json'] : lint;
}

/** Under the "keep" ruleset, a project that keeps tests in `__tests__` may go on doing so. */
function testDirsOf(packages, style) {
  const folders = packages.filter((pkg) => pkg.shape?.testsInFolder > 0);
  if (style === 'suggest' || folders.length === 0) return ['{dir}'];
  return ['{dir}', '{dir}/__tests__', ...folders.map((pkg) => `${pkg.src}/__tests__`)];
}

export function buildConfig(detection, answers) {
  const style = answers.architecture ?? 'keep';
  const packages = detection.packages;
  const roots = rootsOf(packages, style);
  return {
    version: 1,
    status: 'pending',
    mode: answers.mode,
    base: answers.base ?? detection.base,
    workspaces: packages
      .filter((pkg) => pkg.dir === '' || pkg.src || pkg.tsconfigs.length > 0)
      .map((pkg) => ({ dir: pkg.dir, tsconfig: pkg.tsconfigs, test: pkg.stack.test, lint: answers.lint ?? 'kit' })),
    typescript: { flags: answers.typescriptFlags ?? DEFAULT_TS_FLAGS },
    architecture: { roots, folderSize: folderSizeOf(packages, roots, style) },
    testsAlongside: { areas: [...roots.map((root) => `${root.path}/**`), 'scripts/**'], testDirs: testDirsOf(packages, style) },
    hooks: { preCommit: 'fast', prePush: 'fast', ...answers.hooks },
    jscpd: { paths: roots.map((root) => root.path) },
    knip: { config: null, production: false },
    verify: { apps: verifyApps(packages, answers, style) },
    integrity: { protect: protectedGlobs(answers.mode) },
    ...(answers.mode === 'team' ? { ci: { runsOn: 'ubuntu-latest', install: { run: `${detection.packageManager === 'npm' ? 'npm ci' : `${detection.packageManager} install --frozen-lockfile`}` }, ...answers.ci } } : {}),
  };
}
