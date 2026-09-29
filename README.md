# quality-kit

A plugin that turns any existing JS/TS project into an environment where
coding agents are **forced** to ship quality work. It brings the skills
(setup, playbooks, verify) and, unlike [pstack](https://github.com/JoshueOsuna/pstack),
the **mechanical guards**: the agent cannot end its turn with the gate red and
cannot loosen the ruleset on its own.

## The trust ladder

The idea comes from Lauren Tan: each rung catches what the previous one lets
through.

1. **Structure prevents the mistake.** A configurable architecture checker
   (folders, layers, import direction, the framework's routes folder, names).
2. **Static analysis.** Type-aware lint with zero warnings (a strict preset,
   with its rules locked against `eslint-disable`), strict TypeScript, tests
   linked to the touched files, a test next to every new file with logic, knip
   and jscpd.
3. **Method and runtime proof.** Playbooks behind a router (bug-fix, feature,
   refactor, perf, investigation) and `verify`, which opens the affected
   screens on desktop and mobile with Playwright and records the proof the
   gate checks.

## Installation

In Claude Code:

```
/plugin marketplace add half144/quality-kit
/plugin install quality-kit@quality-kit
```

Then, inside the project: "set up the quality-kit in this project" (the
`setup` skill). It runs `quality-kit install` once per machine: the
dependencies (eslint, typescript-eslint, knip, jscpd, playwright) live in
`~/.quality-kit/runtime`, never in the project. Inside Claude Code the plugin
already puts `quality-kit` on the PATH; in your own terminal, add
`~/.quality-kit/bin` to the PATH.

In Codex: `codex plugin marketplace add half144/quality-kit` and
`codex plugin add quality-kit@quality-kit` (the catalog is in
`.agents/plugins/marketplace.json` and the skills in `skills/`, in the format
Codex reads).

## Language

The kit is in English. The files `setup` writes into your project
(ARCHITECTURE.md, the screen map, PLAYBOOKS.md, the AGENTS.md snippet, the
workflow and hook comments) follow the project's language: the skill reads the
README and the existing docs, and asks when it cannot tell. English (`en`) and
Brazilian Portuguese (`pt-BR`) are supported.

## The two modes

| | Local | Team |
| --- | --- | --- |
| Where the ruleset lives | `~/.quality-kit/projects/<id>/` | `.quality/` in the repo |
| Does the repo change? | No (`git status` stays clean) | Yes, in a PR |
| Lint | The kit's config on top of the project's | Same, or the project's own preset |
| Strict TS | Flags on the `tsc` command line | Same |
| Git hooks | `.git/hooks` (never pushed) | Versioned `.githooks/` |
| CI | None | `.github/workflows/quality.yml` |
| Claude deny list | Only the plugin guard | Guard + `.claude/settings.json` |

In both, the gate only checks what was touched relative to the base: today's
debt is frozen (lint, tsc, architecture) and can only shrink; new code is born
clean.

## What each guard does

- **Gate (`quality-kit gate`).** A single command, called by the
  Stop/SubagentStop hook, by the git hooks and by CI. It runs on the touched
  files: architecture, type-aware lint, strict typecheck, linked tests, a test
  next to each new file, the debt ratchet, knip, jscpd and the `verify` proof
  when a screen changed. When it fails, Claude Code does not let the agent
  stop and hands back the report of what to fix.
- **Integrity lock.** The gate stores, signed with a key from this machine,
  the hash of the ruleset (config, extra rules, protected files) and the
  accepted debt. A changed ruleset fails with "the ruleset was changed; a
  ruleset change is a human decision: run `quality-kit rules accept`". That
  command only runs in a real terminal, outside any agent or hook. In team
  mode the base branch's ruleset (the one that went through merge review)
  also counts, and CI only accepts a new ruleset when the PR has the
  `regua-aprovada` label.
- **Guard (PreToolUse).** Keeps out of the agent's reach the key, the
  acceptances, the kit's code, `rules accept`, `--suppress-all` and
  `--no-verify`.
- **Git hooks.** `pre-commit` and `pre-push` run the fast profile (structure,
  colocated tests, debt). They serve Codex, which has no Stop hook.
- **CI (team mode).** The full gate on the PR, pinned to the same kit version.

## Skills

`setup` (sets everything up and freezes the debt), `task` (the router) and the
playbooks `bug-fix`, `feature`, `refactor`, `perf`, `investigation`; `verify`
(on-screen proof), `map` (keeps the screen map and the checker current) and
`gardener` (an anti-pattern that comes back becomes a rule, with the code
fixed).

## Codex

Codex reads the same skills and the snippet `setup` injects into `AGENTS.md`.
It has no Stop hook, so for Codex the guards are the git hooks and CI; the
agent is told to run `quality-kit gate` before finishing. The next step is a
Paseo plugin that fires the gate at the end of each Codex turn.

## The limit

The guard is against the agent's shortcut, not against whoever owns the
machine. The machine owner can always turn the plugin off, delete the ruleset
or accept anything; the agent cannot. In team mode, protect `.quality/` with
CODEOWNERS so ruleset changes go through review.

## License

MIT.
