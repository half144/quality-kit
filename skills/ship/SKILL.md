---
name: ship
description: "Opens or updates the PR with `quality-kit ship`: the approved tiny plan, fresh evidence and the gate summary. Use when the work is done and the gate is green, or when asked to open the PR (\"ship it\", \"abre a PR\")."
---

# ship: the PR tells the whole story

1. **Commit** the work in small commits (the pre-commit hook runs the fast gate).
2. **Preview:** `quality-kit ship --dry-run` prints the title (the plan's goal)
   and the body: the plan, the evidence and the checks that passed. Read it.
3. **If it refuses**, do what it says:
   - no approved plan: skill `tiny-plan`, and wait for the owner's ok;
   - evidence missing or stale: skill `evidence`;
   - the gate fails: fix the code.
   Never work around it (no hand-written `gh pr create`).
4. **Ship:** `quality-kit ship` pushes the branch, uploads the images and
   videos as GitHub attachments (never committed to the repo) and opens the PR
   against the ruleset's base (`--base <branch>` and `--title <text>` override).
   If the branch already has an open PR, it rewrites that PR's title and body:
   after review changes, recapture the evidence and ship again.
5. **Upload failures:** the PR lists the local paths instead and the command
   says which files failed. Tell the owner in your response, with the paths.

Reply with the PR URL and one line on what it does.
