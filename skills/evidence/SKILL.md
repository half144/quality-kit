---
name: evidence
description: quality-kit PR evidence - screenshots (desktop and phone, framed like a browser window and a drawn iPhone, optionally marked) and short videos of interactions, recorded for the current state of the files. Use after the gate is green on a change that touches a screen, when ship says "no evidence for the current files", or when asked for "prints", "screenshots for the PR", "a video of the flow", "evidence", "before and after", "marca o bug no print".
---

# evidence: what the reviewer sees

`quality-kit verify` proves the screen opens (the gate reads it). Evidence is
what goes into the PR: the result, captured on the current files. Change a file
after capturing and the evidence goes stale; `ship` refuses stale evidence.

## Stills (almost always)

```
quality-kit evidence still /painel web:/conta
quality-kit evidence still --changed
```

Each screen opens on desktop (1440x810) and phone (iPhone 15 Pro), is
screenshotted, then framed by cutaway (a browser window with the address, the
drawn iPhone). The app starts with the ruleset's `verify.apps` command; if it
is already running, pass `--origin http://127.0.0.1:3000`.

**Clean by default.** A new screen, a layout change or anything the reviewer
sees at a glance goes without marks. Mark only when the eye would miss it: a
bug repro (the wrong value on screen) or a one-element change lost in a busy
page.

```
quality-kit evidence still /painel --mark "[data-testid=total]" --actual "R$ 0,00" --expected "R$ 120,00"
```

A red outline on the element and a caption box; `--actual` and `--expected`
are optional, one of them is enough for a fix ("Expected: the total").

**Look at every framed image** (the paths are printed). A still of the wrong
state is worse than none: check the data loaded, the right screen, nothing
covering the change.

## Video (only for an interaction)

Write a cutaway plan (JSON) with the steps, and record it:

```json
{
  "url": "/painel",
  "steps": [
    { "action": "click", "selector": "[data-testid=add-guest]" },
    { "action": "type", "selector": "input[name=name]", "text": "Ana" },
    { "action": "click", "selector": "button[type=submit]", "expect": "[data-testid=guest-ana]" }
  ]
}
```

```
quality-kit evidence record /tmp/add-guest.json
```

- `url` may be a screen path (`/painel`, `admin:/users`): the kit starts the
  app (or uses `--origin`). A full URL is used as is.
- For a phone video add `"device": "iPhone 15 Pro"` and use `tap` / `swipe`.
- Actions: `click`, `type`, `focus`, `scroll`, `press`, `wait`, `upload`; give
  important steps an `expect` (the visible result). Selectors are Playwright
  locators and must match one element. Don't pad with `wait`.
- It records at PR size (1280x720, phone 720x1280, standard quality) so it
  plays in GitHub and stays under the attachment limit. Keep it under ~30 s.
- A step that saves data writes wherever the app points: use local or demo data.

## Housekeeping

- `quality-kit evidence status`: what the branch has, fresh or STALE.
- `quality-kit evidence clear`: start over.
- `quality-kit evidence doctor`: is the recorder ready (Chromium, canvas,
  FFmpeg)? A missing FFmpeg: run `quality-kit install` again or install one.
