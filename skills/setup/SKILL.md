---
name: setup
description: "Sets up the quality-kit in a JS/TS project (Next, Expo, Vite/React, Node, Convex; monorepo or not): reads it, asks 3 to 5 questions, writes the ruleset and freezes today's debt. Run once per project."
disable-model-invocation: true
---

# setup: install the quality-kit in a project

The kit builds the trust ladder: (1) structure prevents the mistake, (2)
static analysis, (3) runtime proof. The core is the same for every project;
what belongs to the project is generated here.

`quality-kit` below is the kit's command. In Claude Code the plugin already
puts it on the Bash PATH. In Codex, or outside the plugin, use `bin/quality-kit`
from the kit clone; after step 1, `~/.quality-kit/bin/quality-kit` works too.

## Steps

1. **Install the kit's dependencies on this machine** (once; it does not touch
   the project): `quality-kit install`.
2. **Read the project:** `quality-kit detect`. Note each package's stack, the
   package manager, the tests, the tsconfigs, the shape of the code (`shape`:
   top-level folders, naming convention, barrels, `__tests__`), and whether
   there is already lint config, knip, jscpd, git hooks and CI. Check what the
   project needs to run (are dependencies installed? if not, install them with
   its own package manager before step 5).
3. **Pick the language of the generated files.** The kit is in English, but
   what it writes into the project (ARCHITECTURE.md, the screen map,
   PLAYBOOKS.md, the AGENTS.md snippet, workflow and hook comments) follows the
   project. Read the README, the existing docs (`AGENTS.md`, `CLAUDE.md`,
   `docs/`) and recent commit messages: `en` for English, `pt-BR` for
   Portuguese. If you cannot tell, add it to the questions in step 4.
4. **Ask (3 to 5 decisions, in a single round).** Use the question tool when
   there is one; otherwise ask in text. Suggest the answer the reading pointed
   to and go with it if the person has no preference:
   - **Architecture:** keep the current one as the ruleset (`keep`: freezes
     today's shape, what exists passes and new code follows it) or suggest the
     feature-based pattern (`suggest`: routes → features → shared, kebab-case,
     no barrels, colocated tests; today's violations go to the baseline).
   - **Mode:** `local` (nothing changes in the repo: ruleset in
     `~/.quality-kit/projects/`, hooks in `.git/hooks`) or `team` (ruleset
     committed in `.quality/`, hooks in `.githooks/`, a CI step, deny list in
     `.claude/settings.json`, snippet in AGENTS.md).
   - **What a screen is:** confirm the apps with UI and the routes folder
     (Next and Expo Router are deduced); for Vite/React without file-based
     routing, which components are screens and the path of each.
   - **How to start the app** for verify (command with `{port}`, build first,
     backend env in a file outside the repo).
   - If it fits: the base branch (`origin/main`?) and the CI runner (team
     mode).
5. **Generate the drafts.** Write the answers to a temporary file outside the
   repo and run `quality-kit init --answers <file>`. Format:

   ```json
   {
     "mode": "local",
     "language": "en",
     "architecture": "keep",
     "base": "origin/main",
     "lint": "kit",
     "apps": { "root": { "name": "web", "start": { "command": "npx vite --port {port} --strictPort --host 127.0.0.1" } } },
     "screens": [{ "app": "web", "file": "App.tsx", "route": "/", "open": "/", "summary": "Home screen", "features": [] }],
     "ci": { "runsOn": "ubuntu-latest", "install": { "run": "npm ci" } }
   }
   ```

   `language`: `en` or `pt-BR` (step 3); it is saved in the config and also
   drives the files `finalize` writes. `apps` is keyed by the package folder
   (`root` for the root). `lint`: `kit` (the kit preset on top of the
   project's config) or `project` (the project already has a strict preset,
   like Flock; then its preset and its suppressions apply).
6. **Review the drafts** in the folder `init` printed (`quality-kit paths`):
   `config.json` (roots, layers, import direction with `imports.forbid`,
   framework special folders in `rootFiles`, workspaces and test runner, tsc
   flags, `verify.apps`), `ARCHITECTURE.md`, `FEATURE_MAP.md` (fill in
   Summary, Feature and the demo path of dynamic routes), `PLAYBOOKS.md` and
   `lint-extra.cjs` (rules the project already asks for in prose, in its
   CLAUDE.md or AGENTS.md, become rules here). Write what you fill in using
   the same language. Adjust until the ruleset describes the project; `init`
   can run again.
7. **Turn it on:** `quality-kit finalize`. It freezes the debt (lint, strict
   tsc, architecture), checks that knip and jscpd run in the project (and
   turns off whatever does not, with the reason), installs the git hooks,
   writes the team mode files, turns the ruleset on and signs the acceptance.
   From then on the ruleset only changes through `quality-kit rules accept`,
   which is for humans.
8. **Measure:** `quality-kit gate` on the current tree (it should pass: the
   old debt is frozen) and `quality-kit map`. In local mode, check that
   `git status` is still clean.

## Report

- Mode, language, ruleset folder and what was generated (in team mode, the
  new files in the repo).
- The decisions and the reason for each.
- The frozen debt: the `finalize` totals (`eslint`, `tsc`, `arch`).
- The checks turned off and why; what the person still has to do (PATH,
  `core.hooksPath` in other clones, the `regua-aprovada` label on GitHub,
  CODEOWNERS for `.quality/`).
- The limit: the machine owner can always turn the kit off; the agent cannot.
