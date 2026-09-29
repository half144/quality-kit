/** Os arquivos tocados agrupados por workspace, com o caminho relativo a ele. */

import { workspaceOf } from '../config.mjs';

export const LINTABLE = /\.[cm]?[jt]sx?$/;
export const TYPED = /\.[cm]?tsx?$/;

export function groupByWorkspace(workspaces, files, filter = LINTABLE) {
  const groups = Map.groupBy(
    files.filter((file) => filter.test(file) && workspaceOf(workspaces, file)),
    (file) => workspaceOf(workspaces, file),
  );
  return [...groups].map(([workspace, members]) => ({ workspace, files: members.map((file) => file.slice(workspace.dir.length)) }));
}
