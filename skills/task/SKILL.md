---
name: task
description: "Entry point for coding work in a project that uses the quality-kit: fix a bug, add or change a feature, refactor, make something faster, or explain how the code works. Routes to the playbook, then runs the tiny plan, the owner's ok, code behind the gate, evidence and the PR. Use before starting any such request, even a short one (\"fix\", \"add\", \"change\", \"refactor\", \"it's slow\", \"how does X work\", \"corrige\", \"adiciona\", \"refatora\")."
argument-hint: "[what to do]"
---

# task: the router

Every task follows a playbook. The playbook is the method: what to prove before
touching anything, how to make the change and how to show it works. Improvising
the method is where the agent goes wrong.

## 1. Pick the playbook

| The request | Playbook |
| --- | --- |
| Something that used to work, or should work, and doesn't | [bug-fix](references/bug-fix.md) |
| New behavior or a requested change in behavior | [feature](references/feature.md) |
| Change the shape of the code without changing what it does | [refactor](references/refactor.md) |
| Slow, heavy, janky, Lighthouse score | [perf](references/perf.md) |
| Understand, explain, locate, weigh options, without changing code | [investigation](references/investigation.md) |

- A bug that only shows up with volume or on a slow device is `perf`.
- A feature that needs bad code reshaped first: `refactor` in its own commit,
  then `feature`.
- An ambiguous request: `investigation` first; if the answer calls for a
  change, say which playbook comes next and continue from step 2.

Read the chosen playbook's file in `references/` in full (only that one),
along with the project's supplement, `PLAYBOOKS.md` in the ruleset folder
(`quality-kit paths`; in team mode `.quality/PLAYBOOKS.md`).

## 2. Size the ceremony

- **A question** (explain, where is, why): the `investigation` playbook. No
  plan, no task list for a one-look answer, no evidence, no PR.
- **A code change of any size**: the full flow below. For a one-line change
  the plan still has its five parts, just short ones; steps that don't apply are
  marked `skipped: <reason>`, and evidence only exists if a screen changed.
- **Kit not set up here** (`quality-kit paths` shows `"mode": null`): follow
  the playbook without plan, evidence or ship, and mention that the owner can
  run `/quality-kit:setup`.

## 3. The flow for a code change

1. **Plan and stop.** Load the `tiny-plan` skill: write the plan, save it,
   show it and **end the turn** asking for the ok. Reading and reproducing
   (without editing files) may come first when the plan needs it; editing
   waits for the ok.
2. **After an explicit ok:** `quality-kit plan approve`, then open the task
   list (in Claude Code the todo list, in Codex `update_plan`) with the
   playbook's steps copied in full and in order, then `evidence` and `ship`
   as the last two items.
3. **Work the playbook.** It ends in the verification of
   [references/verification.md](references/verification.md): the gate and the
   runtime proof that matches what changed. The Stop hook runs the gate and
   won't let the turn end while it fails; in Codex, run `quality-kit gate`
   yourself.
4. **Evidence:** if a screen changed, load the `evidence` skill.
5. **Ship:** load the `ship` skill; it opens the PR with the plan, the
   evidence and the gate summary. Reply with the PR URL.

If the work drifts from the plan (another screen, another approach), rewrite
the plan with `quality-kit plan write`, show it and stop again for a new ok.

## Rules for every playbook

- Start from the up-to-date base (`git fetch` and branch from it).
- Read the project's AGENTS.md and, before touching folders, the ruleset's
  `ARCHITECTURE.md`.
- The tool's official mechanism or nothing: no hacks. When in doubt about a
  library, check the docs for the installed version.
- New logic comes with a test next to it.
- The ruleset (config, lint-extra, baseline, hooks, workflow) is not yours:
  don't edit it to pass. If a rule is wrong, say so and use the `gardener`
  skill to propose the change to a human.
- Don't stop to ask what you can decide by reading the code; decide and record
  the decision in the response. The plan's ok is the one stop.
