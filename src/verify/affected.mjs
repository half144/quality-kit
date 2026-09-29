/**
 * Which screens a change affects, based on the screen map:
 *
 * - a screen file: that screen;
 * - another file in the routes folder (layout, global style): the screens
 *   from that folder down;
 * - a file in `<features>/<x>`: the screens that list `x` (or the
 *   sub-feature);
 * - a shared file, or one from a feature the map does not list: walks up the
 *   importers to a feature in the map or a screen. If nothing imports it, it
 *   counts for the whole app.
 */

import { appOf } from './apps.mjs';
import { screenOfFile } from './feature-map.mjs';

const TEST_FILE = /\.(test|spec)\.|\/__tests__\/|\/__mocks__\/|\/testing\//;
const UI_FILE = /\.([jt]sx|css|scss|sass|less|vue|svelte)$|\.styles\.[jt]s$/;

export function isAppSource(apps, path) {
  return appOf(apps, path) !== null && !TEST_FILE.test(path);
}

/** Changes what shows on screen: component, style or route. This is what requires proof. */
export function isUiFile(apps, path) {
  if (!isAppSource(apps, path)) return false;
  const app = appOf(apps, path);
  return UI_FILE.test(path) || (app.routesDir !== null && path.startsWith(app.routesDir));
}

/** The file's `<features>/<x>` or `<features>/<x>/<sub>`, relative to the app's `src`. */
export function featureFolderOf(app, path) {
  if (!app.featuresDir || !path.startsWith(app.featuresDir)) return null;
  const parts = path.slice(app.featuresDir.length).split('/');
  if (parts.length < 2) return null;
  const [feature, next] = parts;
  const prefix = app.featuresDir.slice(app.src.length);
  if (parts.length < 3 || app.featureLayers.includes(next)) return `${prefix}${feature}`;
  return `${prefix}${feature}/${next}`;
}

/** A screen that lists a whole feature covers its sub-features, and one that lists a sub-feature covers the feature's root. */
function screensOfFeature(screens, app, folder) {
  const related = (listed) => listed === folder || listed.startsWith(`${folder}/`) || folder.startsWith(`${listed}/`);
  return screens.filter((screen) => screen.app === app.name && screen.features.some(related));
}

function screensUnderRoutesDir(screens, app, path) {
  const dir = path.slice(app.routesDir.length).split('/').slice(0, -1).join('/');
  return screens.filter((screen) => screen.app === app.name && (dir === '' || screen.file.startsWith(`${dir}/`)));
}

function directScreens(apps, screens, app, path) {
  const own = screenOfFile(apps, screens, path);
  if (own) return [own];
  if (app.routesDir && path.startsWith(app.routesDir)) return screensUnderRoutesDir(screens, app, path);
  const folder = featureFolderOf(app, path);
  return folder ? screensOfFeature(screens, app, folder) : [];
}

function screensOfPath(apps, screens, path, importersFor) {
  const app = appOf(apps, path);
  const direct = directScreens(apps, screens, app, path);
  if (direct.length > 0 || (app.routesDir && path.startsWith(app.routesDir))) return direct;
  const isOwner = (importer) => directScreens(apps, screens, app, importer).length > 0 || (app.routesDir !== null && importer.startsWith(app.routesDir));
  const owners = importersFor(app, path, isOwner);
  if (owners.length === 0) return screens.filter((screen) => screen.app === app.name);
  return owners.flatMap((owner) => directScreens(apps, screens, app, owner));
}

/** The affected screens, without duplicates and in map order. */
export function affectedScreens(apps, screens, files, importersFor) {
  const hit = new Set(files.filter((path) => isAppSource(apps, path)).flatMap((path) => screensOfPath(apps, screens, path, importersFor)));
  return screens.filter((screen) => hit.has(screen));
}

/** What verify opens: one entry per path, only for screens that take proof. */
export function targetsOf(screens) {
  const seen = new Map();
  for (const screen of screens.filter((entry) => entry.open !== null)) seen.set(`${screen.app} ${screen.open}`, { app: screen.app, path: screen.open });
  return [...seen.values()];
}

