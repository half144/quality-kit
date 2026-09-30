---
name: tiny-plan
description: "Writes the five-part tiny plan for a code change, saves it with `quality-kit plan write` and stops for the owner's ok. The first step of every quality-kit task that changes code, and what the Stop hook asks for when the plan is missing."
user-invocable: false
---

# tiny-plan: the owner says ok before the code

The owner approves the direction, not the details. The plan is short enough to
read in a few seconds and specific enough to say no to.

## 1. Write it

Read only what you need to fill it in (the screen, the files, the data path).
Exactly this template, in the project's language (the labels are the English
ones below, or `Objetivo`, `Contexto`, `Onde`, `Como funciona`, `Prova` in a
Portuguese project), each label written exactly as shown, alone before its
colon:

```
Goal: what changes for the user, one sentence
Context: why now, what exists today, in one or two short sentences
Where:
- payment-pitch.tsx: what changes there
- pix/focus-surface.tsx: what changes there
How it works: the new flow, in one to four short lines
Proof: stills of /event-payment (desktop and phone)
```

- **Goal** is the PR title: what the user gets, not what the code does.
- **Context** is what the owner needs to decide, nothing more. Research, design
  references and the list of what you read stay in your work, not in the plan.
- **Where** is a list: one `file: what changes` bullet per line, 1 to 5 of
  them. The file name only; the path when the name is ambiguous.
- **How it works** is the flow; more than one line becomes a list.
- **Proof** names the screens: clean stills on desktop and phone by default
  (the `evidence` skill), marked only for a bug repro, and a video only for an
  interaction (a flow, an animation, a form). "Before and after" only when the
  before matters: a bug, or a visual change the reviewer has to compare. No
  screen changed: say which test or command proves it. Name no other skill or
  tool here.

**Limits** (`plan write` rejects the plan and says which field to fix):

| Part | Limit |
| --- | --- |
| The whole plan | at most 15 lines |
| Any line or bullet | at most 120 characters |
| Goal | one line |
| Context | at most 2 sentences, on at most 2 lines |
| Where | 1 to 5 bullets, nothing after the colon |
| How it works | at most 4 lines |
| Proof | at most 2 lines |

Over a limit, cut: a long line wrapped onto two is still a text wall.

## 2. Save it

```
quality-kit plan write <<'PLAN'
Goal: ...
PLAN
```

(or `--file <path>`). It checks the template and the limits and stores the
plan for the current branch, outside the repo, along with the state of the
code at that moment. If it refuses, fix exactly the lines it names and write
again.

## 3. Show it and STOP

`plan write` prints the plan as markdown (`quality-kit plan show` prints it
again). Paste that output in your message as it is: not inside a code block,
not retyped, with at most one short line before it. It renders like this:

> **Goal:** the host sees how many guests confirmed
>
> **Context:** the guest page only says "nobody confirmed".
>
> **Where**
> - `guest-list.tsx`: a "Confirm" button on each guest
>
> **How it works:** the button adds one to the count.
>
> **Proof:** stills of /guests (desktop and phone), a short video confirming two guests

End the turn asking for the ok. Do not write code, do not start the playbook
steps, do not approve it yourself. The Stop hook lets the turn end while a
saved plan waits for the ok, as long as no code changed after it was saved.

## 4. Only after an explicit ok

When the owner answers with an explicit ok ("ok", "go", "pode", "manda"),
run `quality-kit plan approve` and continue with the playbook. If they ask for
changes, rewrite, save and show it again: approval is bound to the plan's text,
so an edited plan needs a new ok. Anything that is not an ok is not an ok.

If the work drifts from the plan (another screen, another approach), stop
editing, save the updated plan (`quality-kit plan write`), show it and end the
turn for a new ok. The Stop hook blocks a branch whose code changed without an
approved plan.
