---
name: evidence
description: "Captures PR evidence with `quality-kit evidence`: framed desktop and phone stills (clean by default, marked only for a bug repro) and short videos of interactions. Use before ship on a change that touches a screen, or when asked for screenshots or a video for the PR."
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

### A screen behind a gate: `--plan`

When the screen needs a login, a code, or a click to reach the state worth
showing, write a still plan and capture it. It uses the **same steps as a
video plan** (below), and they run before the shot on desktop and phone:

```json
{
  "url": "/conta/demo",
  "steps": [
    { "action": "type", "selector": "input[name=code]", "text": "123456" },
    { "action": "click", "selector": "button[type=submit]", "expect": "text=My account" }
  ],
  "mark": { "selector": "[data-testid=total]", "expected": "R$ 120,00" }
}
```

```
quality-kit evidence still --plan /tmp/shot.json
```

- `url` is a screen path (`/conta`, `admin:/users`); pass `--origin` if the
  app is already running. `mark` is optional, as on the command line.
- Write `click` / `scroll`: on the phone they run as `tap` / `swipe` (and the
  other way round), so one plan serves both devices. Video-only fields
  (`device`, `pause`, `hold`) are ignored.
- A failing step stops with its number and the Playwright error: fix the
  selector, don't retry blindly.
- **Never record a video to get a still** of a gated screen. A video is for
  an interaction; a still plan is seconds, a video minutes and hundreds of MB.
- `--changed` opens each screen without steps: a gated screen it reaches
  shows the gate. Capture those with `--plan` too.

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
- Only the mp4 is kept: the raw capture (lossless frames, timeline, poster)
  is deleted once the video is exported. cutaway's `render` cannot re-export
  the take afterwards, by design: for another take, `record` again.

## Housekeeping

- `quality-kit evidence status`: what the branch has, fresh or STALE.
- `quality-kit evidence clear`: start over (deletes the branch's stills and
  videos). Any `evidence` command also drops the raw frames that older kit
  versions left next to finished videos.
- `quality-kit evidence doctor`: is the recorder ready (Chromium, canvas,
  FFmpeg)? A missing FFmpeg: run `quality-kit install` again or install one.
