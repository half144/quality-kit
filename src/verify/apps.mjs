/**
 * Os apps que o verify conhece, normalizados da config: onde está o código
 * (`src`), a pasta de rotas do framework (se o roteamento é por arquivo) e a
 * pasta de features. Todos os caminhos são do repo e terminam em `/`.
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

/** Onde mora o `file` de uma linha do mapa: relativo à pasta de rotas, ou ao `src`. */
export function screenRoot(app) {
  return app.routesDir ?? app.src;
}

/** `/caminho` é do primeiro app; `nome:/caminho` é do app com esse nome. */
export function parseTarget(apps, arg) {
  const match = /^(?:([a-z0-9-]+):)?(\/.*)$/i.exec(arg);
  if (!match || /\s/.test(arg)) throw new Error(`"${arg}" não é um caminho: comece com / (ou <app>:/).`);
  const [, name, path] = match;
  const app = name ? apps.find((entry) => entry.name === name) : apps[0];
  if (!app) throw new Error(`Não há app "${name ?? ''}" na config do verify.`);
  return { app: app.name, path };
}

export function targetKey(apps, { app, path }) {
  return app === apps[0]?.name ? path : `${app}:${path}`;
}
