/**
 * A cutaway recording keeps its raw capture next to the video: lossless PNG
 * frames (~550 MB for 5 s), the timeline and camera tracks, the poster. They
 * are there so cutaway `render` can export the take again with other
 * settings. PR evidence never does (a new take is `evidence record` again),
 * so once the mp4 is out only the mp4 stays.
 */

import { existsSync, readdirSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

import { kitHome } from '../runtime.mjs';

/** Everything in a recording folder but the delivered video. Pure. */
export function leftovers(entries, video) {
  return entries.filter((entry) => entry !== basename(video));
}

/**
 * A take whose export finished: cutaway writes `workflow.json` after the
 * video, so a capture still being recorded or exported is never touched. Pure.
 */
export function finishedVideo(entries) {
  if (!entries.includes('frames') || !entries.includes('workflow.json')) return null;
  return entries.find((entry) => entry.endsWith('.mp4')) ?? null;
}

export function trimRecording(recording, video) {
  for (const entry of leftovers(readdirSync(recording), video)) rmSync(join(recording, entry), { recursive: true, force: true });
}

function children(dir) {
  return existsSync(dir) ? readdirSync(dir) : [];
}

/** The recordings under the kit's own evidence folders: `projects/<id>/branches/<branch>/evidence/videos/<take>/recording`. */
function recordings(home) {
  const projects = join(home, 'projects');
  return children(projects).flatMap((project) => {
    const branches = join(projects, project, 'branches');
    return children(branches).flatMap((branch) => {
      const videos = join(branches, branch, 'evidence', 'videos');
      return children(videos).map((take) => join(videos, take, 'recording'));
    });
  });
}

/** Takes recorded before the kit trimmed them (up to v0.3.6) lose their raw frames. */
export function sweepCaptures(home = kitHome()) {
  for (const recording of recordings(home)) {
    const video = finishedVideo(children(recording));
    if (video) trimRecording(recording, video);
  }
}
