# The feature playbook

Copy these steps into the task list after the plan's ok (step 3 of the `task` skill).

1. **Understand what exists.** The data path end to end (route, screen, state,
   backend call, business rule, storage). Look for the pattern the neighboring
   code already uses and the component that already solves it. Reuse before
   you create.
2. **Decide where each piece lives**, according to the ruleset's
   `ARCHITECTURE.md`: list the new and changed files with the layer of each.
   A piece used by two owners moves up to shared code. For a debatable decision
   (data shape, where state lives, function contract): write down the options
   and pick one with the reason.
3. **Plan for compatibility** when backend and frontend deploy separately: the
   new thing ships before whoever uses it, and the old thing only goes away
   afterwards.
4. **Build in slices**, from the bottom up to the screen: each slice with its
   test next to it and the gate green before the next one. Logic (formatting,
   calculation, decisions) goes in pure functions, tested without a browser.
5. **Handle what the screen needs:** empty, loading and error states; mobile
   first; nothing heavy on the path of people who don't use it.
6. **Prove it running**, along the path a person actually uses: `quality-kit
   verify --changed`. A new screen goes into the map (skill `map`) in the same PR.
7. **Verify:** [the task skill's verification](verification.md).
8. **Small commits**, one per slice that makes sense on its own.

## Response

- What the feature does now, in one or two lines.
- The decisions from step 2 that were not obvious.
- The proof: screenshots, output of the new tests.
- What was left for later.
