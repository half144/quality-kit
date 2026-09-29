---
name: map
description: Keeps the quality-kit screen map (the ruleset's FEATURE_MAP.md) and the architecture checker in sync with the code. Use when you create, move or delete a screen or route, when the gate reports "Screen with no row in the screen map", when verify doesn't know how to open a screen, or when asked to "update the screen map", "map the routes" ("atualiza o mapa de telas"). Adds the missing routes, fills in the demo path and the features of each screen, and points out what changed in the structure and needs to become a rule.
---

# map: the screen map and the checker

The map tells verify what to open and tells the gate which screens a change
affects. The checker says where each thing lives. Both fall behind as the code
moves.

1. **Check:** `quality-kit map`. It lists routes with no row in the map and
   rows with no route (in apps with file-based routing, Next and Expo Router).
2. **Add what is missing:** `quality-kit map --write` appends rows for the new
   routes at the end of the app's table. Then fill them in by hand, in the
   ruleset's `FEATURE_MAP.md` (`quality-kit paths`):
   - **Open at:** a path that opens with demo data. A dynamic route
     (`/evento/[id]`) needs an id that exists in the verify environment; without
     one, write the reason in place of the path.
   - **Feature:** the folders (relative to `src`) that feed the screen, so
     `verify --changed` finds the screen when they change.
   - **Summary:** what the screen is, in a few words.
3. **Row with no route:** the screen was removed or moved. Delete the row or fix
   the file.
4. **App without file-based routing** (Vite/React Router): screens are rows
   written by hand, with the screen component in **File** (relative to `src`).
   A new screen is a new row.
5. **Structure that changed:** if the change created a top-level folder, a layer
   or a new convention that the checker rejects, don't work around it: it is a
   ruleset decision. Describe the proposed change in the config
   (`architecture.roots`) and leave it for a human to apply and accept
   (`quality-kit rules accept`), as in the `gardener` skill.
6. **Prove it:** `quality-kit verify --changed` opens the new screens.

The map is not part of the ruleset: editing `FEATURE_MAP.md` needs no
acceptance. The gate only fails a new screen with no row.
