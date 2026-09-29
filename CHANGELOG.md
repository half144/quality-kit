# Changelog

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
