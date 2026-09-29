/**
 * The apps verify knows about, normalized from the config: where the code is
 * (`src`), the framework's routes folder (if routing is file-based) and the
 * features folder. All paths are repo-relative and end in `/`.
 */

const DEFAULT_LAYERS = ['api', 'assets', 'components', 'content', 'hooks', 'stores', 'types', 'utils'];

function folder(path) {
  if (path === undefined || path === null) return null;
  return path === '' || path.endsWith('/') ? path : `${path}/`;
}

export function normalizeApps(verify) {
  return (verify?.apps ?? []).map((app) => ({
    ...app,
    src: folder(app.src),
    routesDir: folder(app.routes?.dir),
    framework: app.routes?.framework ?? 'none',
    featuresDir: folder(app.featuresDir),
    featureLayers: app.featureLayers ?? DEFAULT_LAYERS,
  }));
}

export function appOf(apps, path) {
  return apps.filter((app) => path.startsWith(app.src)).sort((a, b) => b.src.length - a.src.length)[0] ?? null;
}

/** Where a map row's `file` lives: relative to the routes folder, or to `src`. */
export function screenRoot(app) {
  return app.routesDir ?? app.src;
}

/** `/path` belongs to the first app; `name:/path` to the app with that name. */
export function parseTarget(apps, arg) {
  const match = /^(?:([a-z0-9-]+):)?(\/.*)$/i.exec(arg);
  if (!match || /\s/.test(arg)) throw new Error(`"${arg}" is not a path: start with / (or <app>:/).`);
  const [, name, path] = match;
  const app = name ? apps.find((entry) => entry.name === name) : apps[0];
  if (!app) throw new Error(`There is no app "${name ?? ''}" in the verify config.`);
  return { app: app.name, path };
}

export function targetKey(apps, { app, path }) {
  return app === apps[0]?.name ? path : `${app}:${path}`;
}
