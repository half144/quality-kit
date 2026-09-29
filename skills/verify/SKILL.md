---
name: verify
description: quality-kit on-screen proof. Use when the change touches a screen (component, style, route), when the gate reports "On-screen proof", or when asked to "open the screen and check", "prove it works", "check it in the browser", "run verify" ("abre a tela e confere"). Starts the app with the ruleset's command, opens the affected screens on desktop and mobile (iPhone 14), fails on console errors, exceptions, hydration errors, broken assets and blank screens, and writes the report the gate checks.
---

# verify: on-screen proof

A green build and green tests don't prove the screen opens. `quality-kit verify`
opens it.

1. **Work out the screens:** `quality-kit verify --changed` uses the screen map
   (the ruleset's `FEATURE_MAP.md`) and the import graph to find the screens the
   branch affects. For explicit screens: `quality-kit verify /conta web:/painel`
   (no prefix means the first app in the config). `--all` opens every screen in
   the map.
2. **Run it and read the output.** Each screen opens on desktop and mobile. It
   fails on: console errors, exceptions, hydration errors, 4xx/5xx for the site's
   own assets, navigation that doesn't complete and a screen with no text.
3. **Look at the screenshots** in the folder the command prints. A passing report
   with the wrong screen is not proof: check that the screenshot shows what the
   change was supposed to show.
4. **If it failed:** suspect the method first (does the demo path have data? did
   the app start with the right env? check the server log in the same folder),
   then fix the code and run it again.
5. The report is valid for the state of the files it ran against: change a file,
   run it again. The gate only passes with a passing report for the current state.

A new screen, or a demo path that changed: use the `map` skill first.
How to start the app (command, build, env) lives in `verify.apps` in the
ruleset config; changing that is changing the ruleset (a human accepts).
