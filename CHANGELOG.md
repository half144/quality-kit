# Changelog

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
