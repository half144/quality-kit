---
name: perf
description: quality-kit performance playbook, picked by the task router. Use when something is slow, heavy or janky - page load, screen transitions, LCP, INP, CLS, Lighthouse score, a query that reads too much, a large list, a heavy bundle ("it's slow", "optimize this"). Measure before and after; without a measurement, the change does not go in.
---

# perf

Copy these steps into the task list before you start (see `task`).
First read the project's performance rules, if any (AGENTS.md, the ruleset's
PLAYBOOKS.md).

1. **Pick the metric** the person actually feels, on mobile:

   | Symptom | Metric |
   | --- | --- |
   | Page load | `npx -y lighthouse <url> --output=json --chrome-flags="--headless=new"`, median of 3 |
   | Response to a tap | Event Timing API (`PerformanceObserver` for `event`), not the timing of Playwright's `click()` |
   | Backend query | documents read and bytes returned |
   | Bundle | size of the route's chunk in the production build |

2. **Measure the before** on a production build, with the base in a separate
   worktree, alternating A/B runs. Save the output.
3. **Find the bottleneck with the trace**, not by guessing: long tasks, network
   waterfall, what the LCP is waiting on. Hypothesis families: eliminate work,
   defer, send less, split, cache, prefetch on intent.
4. **Change one thing at a time.**
5. **Measure the after** with the same script, profile and number of runs.
   Median. If it didn't improve beyond the noise, revert.
6. **Record the rule** the measurement taught, with the number, wherever the
   project keeps its performance rules.
7. **Verify:** `task/references/verification.md`; the screen is still correct
   (`quality-kit verify --changed`).

## Response

- Before and after table: metric, profile, runs, median.
- The bottleneck in one sentence and the change that removed it.
- Hypotheses that didn't pay off, with the number.
