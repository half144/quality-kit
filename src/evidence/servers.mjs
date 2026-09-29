/** The apps the evidence opens: started with the ruleset's command, or already running at `--origin`. */

import { startApp } from '../verify/servers.mjs';

export async function withServers({ project, apps, dir, names, origin }, work) {
  const servers = {};
  try {
    for (const name of names) {
      servers[name] = origin ? { origin, stop: () => undefined } : await startApp({ repo: project.repo, dir, app: apps.find((app) => app.name === name) });
    }
    return await work(servers);
  } finally {
    Object.values(servers).forEach((server) => server.stop());
  }
}
