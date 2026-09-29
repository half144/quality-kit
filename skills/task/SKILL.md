---
name: task
description: Entry point for every coding task in a project that uses the quality-kit. Use BEFORE starting any request that changes or explains code, even a short one - fixing a bug ("fix", "it's broken", "error", "corrige", "tá quebrado"), creating or changing a feature ("add", "implement", "build", "create", "change", "adiciona"), refactoring ("refactor", "extract", "split this file", "clean up", "move", "refatora"), performance ("it's slow", "optimize", "LCP", "INP", "perf") or investigating ("how does it work", "why", "where is", "explain"). Picks the playbook (bug-fix, feature, refactor, perf, investigation), starts with a tiny plan the owner approves, copies the playbook steps into the task list and closes with verification, evidence and the PR.
---

# task: pick the playbook

Every task follows a playbook. The playbook is the method: what to prove before
touching anything, how to make the change and how to show it works. Improvising
the method is where the agent goes wrong.

The delivery around it is always the same:

```
task -> tiny plan -> owner's ok -> playbook (code, gate) -> evidence -> ship (PR)
```

## 1. Pick

| The request | Playbook |
| --- | --- |
| Something that used to work, or should work, and doesn't | `bug-fix` |
| New behavior or a requested change in behavior | `feature` |
| Change the shape of the code without changing what it does | `refactor` |
| Slow, heavy, janky, Lighthouse score | `perf` |
| Understand, explain, locate, weigh options, without changing code | `investigation` |

Read the chosen playbook in full before the first step, along with the project's
supplement: `PLAYBOOKS.md` in the ruleset folder (`quality-kit paths` shows
where; in team mode, `.quality/PLAYBOOKS.md`).

Edge cases:
- A bug that only shows up with volume or on a slow device is `perf`.
- A feature that requires touching bad code: `refactor` first, in a separate
  commit, then `feature`.
- An ambiguous request: start with `investigation`; if the conclusion calls for
  a change, switch playbooks and say which one.

## 2. Tiny plan first

The first step of every playbook that changes code is the `tiny-plan` skill:
five lines, saved with `quality-kit plan write`, shown to the owner, and then
**stop** until they say ok. Only after an explicit ok run `quality-kit plan
approve` and go on. The Stop hook blocks a branch with code changes and no
approved plan. `investigation` changes no code and skips it; if its conclusion
calls for a change, the plan comes before that change.

## 3. Copy the steps

Open the task list (in Claude Code, the todo list; in Codex, `update_plan`)
with `tiny plan (owner's ok)` as the first item, then the playbook's steps
copied in full, in order, before any task-specific item, and `evidence` and
`ship` as the last two. A step that doesn't apply stays on the list marked
`skipped: <reason>`.

## 4. Close with verification, evidence and the PR

Every playbook ends in [`references/verification.md`](references/verification.md):
the gate and the runtime proof that matches what changed. A green build is not
proof. Then the `evidence` skill captures what the reviewer will see (stills,
and a video for an interaction) and the `ship` skill opens the PR with the
plan, the evidence and the gate summary.

## Rules for every playbook

- Start from the up-to-date base (`git fetch` and branch from it).
- Read the project's AGENTS.md and, if you are going to touch folders, the
  ruleset's `ARCHITECTURE.md`.
- The tool's official mechanism or nothing: no hacks. When in doubt about a
  library, check the docs for the installed version.
- New logic comes with a test next to it.
- The ruleset (config, lint-extra, baseline, hooks, workflow) is not yours:
  don't edit it to pass. If a rule is wrong, say so in the response and use the
  `gardener` skill to propose the change to a human.
- Don't stop to ask what you can decide by reading the code; decide and record
  the decision in the response.
