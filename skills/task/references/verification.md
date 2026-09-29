# Verification: proving it works

Every playbook ends here. The trust ladder has three rungs, and each one catches
what the previous one lets through:

1. **Structure.** The folder rules (the ruleset's `ARCHITECTURE.md`) and the
   checker prevent the mistake before it exists.
2. **Static analysis.** Strict TypeScript, type-aware lint with zero warnings,
   tests wired up, a test next to every new file, knip and jscpd.
3. **Runtime proof.** Run the real artifact and look at the result.

## Rungs 1 and 2: the gate (always)

```
quality-kit gate                   everything, on the files the branch touched
quality-kit gate --profile fast    structure, co-located tests and debt only
```

In Claude Code the Stop hook already runs the gate and won't let the turn end
while it fails. **Codex has no hook:** run `quality-kit gate` yourself before
saying you're done; the git hooks and CI enforce it either way.

If it fails: fix the code. `eslint-disable` on a quality rule,
`--suppress-all`, `!` or `as` to silence the type checker, `--no-verify` and
editing the ruleset are not ways out: the integrity lock fails a changed ruleset
until a human accepts it.

## Rung 3: the proof that matches what changed

| Changed | Proof |
| --- | --- |
| Screen (component, style, route) | `quality-kit verify --changed` before wrapping up. The screens and demo path are in the ruleset's `FEATURE_MAP.md`; a new screen goes into the map (skill `map`). Look at the screenshots, not just the report. |
| Backend, function, script | The test next to it, running, and the real command once (the function called, the script executed). |
| Performance | The `perf` playbook's measurement, before and after, in the same environment. |
| Documentation only | Read the text and check that every command it mentions exists. |

If the proof fails, suspect the observation method first (the right URL? the new
build? the seeded data?), then the code.

## For the PR: evidence and ship

`verify` is the smoke proof the gate reads. The reviewer gets the evidence:
`quality-kit evidence still <path>` (desktop and phone, framed, clean by
default; `--mark` only when the eye would miss the change, like a bug repro) and, for an interaction, `quality-kit evidence record
<plan.json>` (skill `evidence`). Then `quality-kit ship` (skill `ship`) opens
the PR with the tiny plan, the evidence and the gate summary, and refuses if
any of them is missing or stale.

## The response

- Paste the output that proves it, verbatim.
- Label every claim: **measured** (ran it and saw it), **inferred** (read the
  code) or **guess**.
- Don't hand the person a check you could have run yourself.
