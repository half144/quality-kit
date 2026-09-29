---
name: perf
description: "quality-kit perf playbook: measure before and after on a production build; no number, no change. Loaded by the task skill for something slow or heavy; start with task."
user-invocable: false
---

# perf

Copy these steps into the task list after the plan's ok (see the `task` skill).
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
7. **Verify:** [the task skill's verification](../task/references/verification.md); the screen is still correct
   (`quality-kit verify --changed`).

## Response

- Before and after table: metric, profile, runs, median.
- The bottleneck in one sentence and the change that removed it.
- Hypotheses that didn't pay off, with the number.
