# quality-kit

**Make coding agents unable to ship bad code.**

quality-kit is a plugin for Claude Code (and Codex) that turns any existing
JS/TS project into an environment where agents are *forced* to deliver
quality work:

- **They can't finish with broken code.** When an agent tries to end its turn,
  a gate checks what it changed. If anything fails, the agent has to keep
  working until it passes.
- **They can't loosen the rules.** Editing the lint config, the debt baseline or
  the hooks is detected and blocked. Changing the rules is a human decision.
- **They have to prove it works.** Changed a screen? The agent must open it in a
  real browser (desktop and mobile) before it's allowed to stop.
- **They follow a method.** Bug fixes start with a failing test, refactors pin
  behavior first, perf changes are measured before and after.

It works on existing codebases: today's debt is frozen and can only shrink,
and new code is born clean.

---

## How it works

```
 you ask for a task
        │
        ▼
 agent picks a playbook (bug-fix, feature, refactor, perf, investigation)
        │
        ▼
 agent writes code ─────────────────────────────┐
        │                                        │
        ▼                                        │
 agent tries to stop → GATE runs on changed files│
        │                                        │
   ┌────┴────┐                                   │
 fails     passes                                │
   │         │                                   │
   │         ▼                                   │
   │   done ✓ (commit / push / PR)               │
   │                                             │
   └── report goes back to the agent ────────────┘
       "fix these before you can stop"
```

The same gate also runs on `git commit`, `git push` and in CI, so there is one
source of truth for "good enough".

---

## Quick start

**1. Install the plugin** (once per machine), in Claude Code:

```
/plugin marketplace add half144/quality-kit
/plugin install quality-kit@quality-kit
```

For Codex:

```
codex plugin marketplace add half144/quality-kit
codex plugin add quality-kit@quality-kit
```

**2. Set it up in a project.** Open the project and ask the agent:

> set up the quality-kit in this project

The `setup` skill reads the project (stack, folders, scripts, routes), asks you
3–5 questions, writes the ruleset, measures today's debt and freezes it. The
tools it needs (eslint, typescript-eslint, knip, jscpd, playwright) are
installed once in `~/.quality-kit/`, never in your project.

**3. Work normally.** From now on every agent in this project is held to the
ruleset. Nothing else to do.

> Using your own terminal? Add `~/.quality-kit/bin` to your `PATH` to run
> `quality-kit` commands. Inside Claude Code it's already there.

---

## The daily workflow

### 1. You ask for something

The `task` skill routes the request to a playbook and copies its steps into the
agent's task list:

| Playbook | What it forces |
| --- | --- |
| `bug-fix` | reproduce first, write the failing test, fix the root cause |
| `feature` | small verifiable steps, tests with the code |
| `refactor` | pin current behavior with tests before touching anything |
| `perf` | measure before and after; no number, no merge |
| `investigation` | explain the system without changing code |

### 2. The agent tries to finish → the gate runs

Only on the files the branch changed, so it's fast. If something fails, Claude
Code blocks the stop and hands the report back:

```
Architecture: import-direction  src/shared/utils/formatPrice.ts
  ../../overlay/types: shared/ is used by both windows and imports from neither.
New file with logic and no test next to it:
  src/shared/utils/formatPrice.ts  ->  create src/shared/utils/formatPrice.test.ts
ESLint: no-explicit-any, no-unsafe-call, no-unsafe-member-access
```

The agent fixes it and tries again. It can't talk its way out.

### 3. Changed a screen? Prove it

```
quality-kit verify --changed
```

Finds the screens affected by the diff (using the screen map), opens each one
on desktop and iPhone, and fails on console errors, hydration errors, broken
assets or an empty page. The gate only accepts a proof made on the current
state of the files: edit again, prove again.

### 4. Commit and push

`pre-commit` and `pre-push` run the fast profile of the same gate (structure,
tests next to new files, debt ratchet). This is the guard that also covers
Codex and humans.

### 5. Pull request (team mode)

CI runs the full gate on the whole change, pinned to the same kit version.

---

## Changing the rules

Rules change on purpose, never by accident. Any edit to the ruleset (lint
config, tsconfig flags, hooks, CI workflow, frozen debt) makes the gate fail:

```
The ruleset was changed; a ruleset change is a human decision:
run `quality-kit rules accept`.
```

To approve it, **you** run in a real terminal:

```
quality-kit rules accept
```

It lists what changed and asks you to type `accept`. Agents can't run it: a
guard blocks the command inside the agent, and it refuses to run without an
interactive terminal. In CI (team mode), the equivalent is adding the
`regua-aprovada` label to the PR.

Useful while deciding:

```
quality-kit rules status     # does the current ruleset match the accepted one?
```

---

## Local or team mode?

You pick one during `setup`.

| | **Local** | **Team** |
| --- | --- | --- |
| Use it when | you want the guardrails for *your* agents, without touching the repo | the whole team (and CI) should follow the rules |
| Where the ruleset lives | `~/.quality-kit/projects/<id>/` | `.quality/` in the repo |
| Repo changes | none (`git status` stays clean) | yes, in a PR |
| Git hooks | `.git/hooks` (never pushed) | versioned `.githooks/` |
| CI | none | a gate step in your workflow |

In both modes the gate only judges what was touched: old code doesn't get
worse, new code is born clean.

---

## What the gate checks

| Check | Catches | Hook | Git | CI |
| --- | --- | :-: | :-: | :-: |
| Architecture | files in the wrong folder, forbidden imports between layers | ✓ | ✓ | ✓ |
| Type-aware lint | unsafe types, complexity, size limits, banned patterns | ✓ | | ✓ |
| Strict TypeScript | `noUncheckedIndexedAccess` and friends | ✓ | | ✓ |
| Related tests | tests linked to the changed files | ✓ | | ✓ |
| Test next to new file | new logic without a test | ✓ | ✓ | ✓ |
| Debt ratchet | the frozen debt growing | ✓ | ✓ | ✓ |
| Dead code (knip) | unused exports, files, dependencies | ✓ | | ✓ |
| Duplication (jscpd) | new copy-paste | ✓ | | ✓ |
| Screen proof (verify) | a changed screen that wasn't opened | ✓ | | |
| Ruleset integrity | the rules edited without a human | ✓ | ✓ | ✓ |

---

## Keeping it fitted to your project

The core is the same everywhere. What's specific to your project is generated
by `setup` and kept current by two skills:

- **`map`**: updates the screen map and the architecture config when the
  project grows (`quality-kit map` fails if a route has no entry).
- **`gardener`**: when an anti-pattern keeps coming back, turns it into a lint
  rule and fixes the existing code ("one blessed way per thing").

---

## Commands

**Everyday**

| Command | What it does |
| --- | --- |
| `quality-kit gate` | run the checks on what changed (`--profile fast` for the quick set) |
| `quality-kit verify --changed` | open the affected screens and record the proof |
| `quality-kit map` | check the screen map against the real routes |
| `quality-kit rules status` | is the ruleset the accepted one? |

**Humans only** (need an interactive terminal)

| Command | What it does |
| --- | --- |
| `quality-kit rules accept` | approve a ruleset change |
| `quality-kit baseline` | re-freeze the debt |

**Setup and internals**: `install`, `detect`, `init`, `finalize`, `paths`,
`serve`, and the hook entry points `hook`, `guard`, `git-hook`. The `setup`
skill calls these for you.

---

## Codex

Codex reads the same skills and the snippet `setup` adds to `AGENTS.md`. Codex
has no "end of turn" hook yet, so for Codex the enforced guards are the git
hooks and CI, and the agent is instructed to run `quality-kit gate` before
finishing. A Paseo plugin that runs the gate at the end of each Codex turn is
the next step.

---

## Limits

- **It stops the agent, not the machine owner.** You can always turn the plugin
  off, delete the ruleset or accept anything. The agent can't. In team mode,
  protect `.quality/` with CODEOWNERS so rule changes go through review.
- **JS/TS only for now**, with ESLint flat config (`eslint.config.js/.mjs/.cjs`).
- **Screens need a way in.** `verify` needs a URL that opens each screen with
  data (a demo route, a seed). Screens without one are listed as unproven.

---

## Why

The approach follows Lauren Tan's *trust ladder*: agents scale when you can
trust what they ship, and trust is built in rungs, strongest first.

1. **Structure prevents the mistake:** the wrong path isn't possible.
2. **Static analysis catches the rest:** lint, compiler, CI.
3. **Method and runtime proof:** a build passing isn't proof; running the
   thing is.

[pstack](https://github.com/JoshueOsuna/pstack) packages the method (rung 3) as
skills. quality-kit adds the part pstack leaves to each codebase: the
mechanical guards that make rungs 1 and 2 impossible to skip.

## License

MIT © half144
