---
name: bug-fix
description: quality-kit bug-fix playbook, picked by the task router. Use when something that used to work, or should work, is wrong - an error on screen, wrong data, a crash, a broken test, a regression ("fix this bug", "it's broken", "corrige esse bug"). Reproduce first, write the failing test, fix the root cause and prove it on the same surface where the bug showed up.
---

# bug-fix

Copy these steps into the task list before you start (see `task`).

1. **Reproduce it yourself**, on the surface where the bug shows up: the screen
   (`quality-kit verify <path>` with the demo path from the map, or the
   running app), the function in a test, the script. If the trigger is rare
   (time zone, volume, mobile, slow connection), force it. Write down the
   command and its output.
2. **Find the cause, not the symptom.** List hypotheses along the data path and
   rule them out one by one with runtime evidence (a test, a temporary log, a
   query), not by reading. Only move on once you know the mechanism: "X arrives
   as Y because Z".
3. **Write the failing test**, next to the file where the cause lives. It has to
   fail for the right reason: run it and check the message. Cover the adjacent
   edge case the same mechanism would break. If the bug only exists on screen,
   the proof in step 6 plays that role; note it.
4. **Fix the root cause**, with the smallest diff that removes the mechanism. No
   guard in the consumer to hide bad data from the producer, no `try/catch`
   that swallows, no `setTimeout` or `!important`. If the cause is in shared
   code, check the other callers.
5. **Watch the test pass**, along with the whole workspace suite.
6. **Prove it on the same surface.** Repeat the reproduction from step 1 and
   show the error is gone.
7. **Verify:** `task/references/verification.md`.
8. **Commit** with the cause in the message, not just the symptom.

## Response

- The cause in one sentence, with `file:line`.
- The test output failing and then passing, verbatim.
- The proof from step 6.
- What was left out and why.
