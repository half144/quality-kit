<!-- quality-kit:start -->
## Quality (quality-kit)

This repo uses the [quality-kit](https://github.com/half144/quality-kit): work
only counts as done after it climbs the trust ladder.

1. **Structure.** The ruleset for folders, layers and imports is in
   `{architecture}`; the checker fails anything that strays from it.
2. **Static analysis.** Type-aware lint with zero warnings, strict TypeScript,
   tests linked to the touched files, a test next to every new file with
   logic, dead code and duplication.
3. **Runtime proof.** If you changed a screen, run `quality-kit verify
   --changed`; the screens and how to open them are in `{map}`.

Every task starts with the `task` skill (the router), which picks one of its
playbooks (`bug-fix`, `feature`, `refactor`, `perf`, `investigation`). The
project's real commands are in `.quality/PLAYBOOKS.md`.

Before saying you are done, run `quality-kit gate` (if it is not on the PATH:
`node ~/.quality-kit/kit/bin/quality-kit.mjs gate`) and fix whatever it
fails. In Claude Code the Stop hook already does this and does not let the
turn end on a failure; Codex has no such hook, so there the guards are the git
hooks and CI.

The ruleset (`.quality/config.json`, `lint-extra.cjs`, the baseline, the hooks
and the workflow) is a human decision: the gate fails any change to it until
someone runs `quality-kit rules accept` in a terminal. Do not disable rules
with comments or bulk-suppress: fix the code.
<!-- quality-kit:end -->
