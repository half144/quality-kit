---
name: tiny-plan
description: quality-kit tiny plan, the first step of every task that changes code, picked by the task router. Use before writing code for a bug fix, feature, refactor or perf change, when the Stop hook says "write a tiny plan with the tiny-plan skill", or when asked to "plan this", "what's the plan", "make a plan first" ("faz um plano", "qual o plano"). Writes a five-line plan the owner reads in seconds, saves it for the branch, shows it and waits for an explicit ok before any code.
---

# tiny-plan: the owner says ok before the code

The owner approves the direction, not the details. The plan is short enough to
read in a few seconds and specific enough to say no to.

## 1. Write it

Read only what you need to fill it in (the screen, the files, the data path).
Exactly this template, at most 15 lines, in the project's language (the labels
are the English ones below, or `Objetivo`, `Contexto`, `Onde`, `Como funciona`,
`Prova` in a Portuguese project):

```
Goal: what changes for the user, one sentence
Context: why now, what exists today
Where: 3 to 5 files or screens
How it works: the new flow in 2 to 4 lines
Proof: which screenshots or video will go in the PR
```

- **Goal** is the PR title: what the user gets, not what the code does.
- **Where** lists files or screens; a list under the label is fine.
- **Proof** names the screens for stills (desktop and phone) and says whether
  there is a video. A video only when the change is an interaction (a flow, an
  animation, a form); a static result is a still. No screen changed: say which
  test or command proves it.

## 2. Save it

```
quality-kit plan write <<'PLAN'
Goal: ...
PLAN
```

(or `--file <path>`). It checks the template and stores the plan for the
current branch, outside the repo.

## 3. Show it and STOP

Paste the plan in the chat, as saved, and end the turn asking for the ok.
Do not write code, do not start the playbook steps, do not approve it yourself.

## 4. Only after an explicit ok

When the owner answers with an explicit ok ("ok", "go", "pode", "manda"),
run `quality-kit plan approve` and continue with the playbook. If they ask for
changes, rewrite, save and show it again: approval is bound to the plan's text,
so an edited plan needs a new ok. Anything that is not an ok is not an ok.

If the work drifts from the plan (another screen, another approach), update the
plan and ask again before finishing: the Stop hook blocks a branch with code
changes and no approved plan.
