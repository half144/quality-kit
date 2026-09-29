---
name: tiny-plan
description: "Writes the five-line tiny plan for a code change, saves it with `quality-kit plan write` and stops for the owner's ok. The first step of every quality-kit task that changes code, and what the Stop hook asks for when the plan is missing."
user-invocable: false
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
current branch, outside the repo, along with the state of the code at that
moment.

## 3. Show it and STOP

Paste the plan in the chat, as saved, and end the turn asking for the ok.
Do not write code, do not start the playbook steps, do not approve it yourself.
The Stop hook lets the turn end while a saved plan waits for the ok, as long
as no code changed after it was saved.

## 4. Only after an explicit ok

When the owner answers with an explicit ok ("ok", "go", "pode", "manda"),
run `quality-kit plan approve` and continue with the playbook. If they ask for
changes, rewrite, save and show it again: approval is bound to the plan's text,
so an edited plan needs a new ok. Anything that is not an ok is not an ok.

If the work drifts from the plan (another screen, another approach), stop
editing, save the updated plan (`quality-kit plan write`), show it and end the
turn for a new ok. The Stop hook blocks a branch whose code changed without an
approved plan.
