# Changelog

## v0.3.5

- **The tiny plan reads as markdown, not a text wall.** `plan write` and
  `plan show` print the plan rendered (bold labels, Where as a bulleted list
  with file names in inline code, a multi-line section as a list), and the
  agent pastes that output as is, outside a code block. `ship` uses the same
  renderer, so the PR shows the plan the owner approved.
- **Limits on the plan.** At most 15 lines and 120 characters per line; Goal
  one line; Context at most 2 sentences; Where 1 to 5 bullets; How it works at
  most 4 lines; Proof at most 2. The error names the field and bullet to cut.
  A label written with a note (`Onde (só apresentação):`), in bold or in the
  other language is reported by line with the exact label to write; before,
  the only message was "The sections must be exactly, in this order".
- **Proof guidance.** Clean stills by default, marked only for a bug repro,
  "before and after" only when the before matters, no outside skills named.
- Plans saved by older versions still load, approve, render and ship. The
  ruleset hash of existing projects does not change.

## v0.3.4

- **The owner sees when the agent waits for the plan's ok.** When the turn
  ends on a saved plan waiting for approval, the Stop hook shows
  `quality-kit: waiting for your ok on the plan (quality-kit plan show)`
  (exit 0 with `systemMessage`, so it informs without blocking). Before, the
  turn ended silently and the pause could pass for finished work. A plan
  saved on a branch with no code yet counts as waiting too.
- **The playbooks are part of `task`.** `bug-fix`, `feature`, `refactor`,
  `perf` and `investigation` moved from separate skills to
  `skills/task/references/`, and `task` reads only the one it picks. Their
  steps are unchanged. The ruleset hash of existing projects does not change.

## v0.3.3

- **Stopping to ask for the plan's ok works mid-branch.** `plan write`
  records the state of the code; while a saved plan waits for the ok and no
  code changed since, the Stop hook lets the turn end. Before, a branch that
  already had code (a second task, a plan updated after drift) blocked every
  Stop, so the agent could never wait for the owner.
- **Plugin updates no longer break the hook.** The dependency runtime is
  keyed by the lockfile's dependency set instead of the kit version, so a
  release that changes no dependency needs no new `quality-kit install`.
  (This release moves the runtime once: run `quality-kit install` after it.)
- **`ship` updates the open PR** of the branch instead of failing on
  `gh pr create`: after review changes, recapture the evidence and ship again.
- **`quality-kit <command> --help`** prints that command's options anywhere,
  even outside a set-up project. The overview lists every action.
- **Skills:** descriptions cut from ~6,000 to ~2,700 characters in context,
  so the skill listing stops hiding them. `task` is the one trigger (with an
  `argument-hint`); the playbooks and `tiny-plan` are loaded by it and left
  out of the `/` menu; `setup` only runs when the owner calls it. `task`
  spells out the chain skill by skill, keeps questions free of plan and PR,
  and handles a project without the kit.

## v0.3.2

- Evidence stills are clean by default: the skill marks the screen only when
  the eye would miss the change (a bug repro, one element in a busy page).

## v0.3.1

- cutaway is pinned to its `v0.2.0` release (the first tag with `frame` and
  the bundled FFmpeg) instead of a bare commit.

## v0.3.0

The kit now carries the whole delivery: task, tiny plan, the owner's ok, code
behind the gate, evidence, PR.

- **Tiny plan.** New `tiny-plan` skill and `quality-kit plan write | show |
  status | approve`. Five labeled lines (Goal, Context, Where, How it works,
  Proof; or the Portuguese labels), at most 15, stored per branch in
  `~/.quality-kit/projects/<id>/branches/<branch>/`. The approval records the
  plan's hash: editing the plan takes it away. The `task` router starts every
  code-changing playbook with it.
- **The Stop hook requires the plan.** A branch with code changes and no
  approved plan cannot finish. Only the Claude Code hook applies it: never
  `gate --ci`, never the git hooks. `"requirePlan": false` in the config turns
  it off; configs without the key get `true`, and the file is not rewritten,
  so the ruleset hash of existing projects does not change.
- **Evidence.** New `evidence` skill and `quality-kit evidence still | record |
  status | clear | doctor`: desktop and phone screenshots, optionally marked
  (outline and an actual vs expected caption), framed as a browser window or a
  drawn iPhone; videos of interactions from a cutaway plan at PR size. A
  manifest per branch records the tree each item was captured on; stale items
  cannot go into a PR. `verify` stays the gate's runtime proof.
- **Ship.** New `ship` skill and `quality-kit ship [--dry-run]`: opens the PR
  with the plan, the evidence (uploaded as GitHub attachments, local paths if
  the upload fails) and the gate summary, in the project's language. Refuses
  without an approved plan, with changed screens and no fresh evidence, or
  with the gate failing.
- **cutaway is a pinned dependency** (tarball of commit `15a060b`, which has
  `frame` and the bundled FFmpeg; the `v0.1.0` tag predates both).
  `quality-kit install` downloads its FFmpeg and runs its doctor; a runtime
  from an older kit version is no longer taken as complete.
- verify screenshots of `/` are named `root` (they were `raiz`).

## v0.2.0

- The kit is now in English: README, skills (including the `description` that
  triggers each one), gate, hook, checker and ratchet messages, code comments
  and tests.
- `setup` writes the project's files in the project's language (`language`:
  `en` or `pt-BR` in the answers, saved in the config). `quality-kit map
  --write` appends rows in the language the existing map is written in.
  Projects set up with v0.1.0 keep their Portuguese files.
- Machine interfaces are unchanged: commands, flags (`--allow-regua-change`),
  the `regua-aprovada` label, config keys and baseline files. The one visible
  exception: `rules accept` and `baseline` now ask you to type `accept`
  (it was `aceito`).
- Plugin and package metadata list half144 as the author.

## v0.1.0

- First release: the gate on Stop, the ruleset integrity lock, the setup
  skill, playbooks and verify.
