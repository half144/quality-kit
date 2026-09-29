---
name: verify
description: "Runs `quality-kit verify`, the on-screen proof the gate requires: opens the changed screens on desktop and mobile and fails on console errors, crashes and blank screens. Use when a change touches a screen or the gate reports \"On-screen proof\"."
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

verify is the proof for the gate. The screenshots and video for the PR come
from the `evidence` skill (`quality-kit evidence still`), framed and recorded
on the same files.
