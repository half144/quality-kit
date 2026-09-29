/**
 * Media into the PR body. gh cannot attach files; GitHub's web drag-and-drop
 * uses the user-attachments endpoint, which answers with the asset URL. It
 * needs the numeric repository id and a token (`gh auth token`).
 */

import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

const CONTENT_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };

export function contentTypeOf(file) {
  const type = CONTENT_TYPES[extname(file).toLowerCase()];
  if (!type) throw new Error(`${file}: GitHub attachments take png, jpg, gif, mp4, webm or mov.`);
  return type;
}

/** The request as data, so it can be checked without the network. Pure. */
export function uploadRequest({ repositoryId, token, file, body }) {
  const contentType = contentTypeOf(file);
  const query = new URLSearchParams({ name: basename(file), content_type: contentType, repository_id: String(repositoryId) });
  return {
    url: `https://uploads.github.com/user-attachments/assets?${query}`,
    init: { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType, Accept: 'application/json' }, body },
  };
}

export async function uploadAsset({ repositoryId, token, file, fetchImpl = fetch }) {
  const { url, init } = uploadRequest({ repositoryId, token, file, body: await readFile(file) });
  const response = await fetchImpl(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.url !== 'string') throw new Error(`upload of ${basename(file)} failed (HTTP ${response.status})`);
  return payload.url;
}

/** Every item uploaded, or kept with its local path when its upload fails. */
export async function uploadAll(items, options) {
  const failures = [];
  const uploaded = [];
  for (const item of items) {
    try {
      uploaded.push({ ...item, url: await uploadAsset({ ...options, file: item.path }) });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
      uploaded.push(item);
    }
  }
  return { uploaded, failures };
}
