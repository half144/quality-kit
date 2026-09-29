---
name: gardener
description: "Turns a recurring anti-pattern into a mechanical rule (lint, checker or test), fixes the existing code and hands the ruleset change to a human. Use when the same mistake shows up a second time, or when asked to \"make it a rule\" (\"vira regra\")."
---

# gardener: the anti-pattern becomes a rule

A rule written in prose gets forgotten; a mechanical rule does not. The gardener
prunes the second way before another agent copies it.

1. **Name the anti-pattern and the right way**, with the real examples
   (`file:line`) and the reason (the incident, the bug, the review).
2. **Pick the lowest step that catches it:**
   - **Structure** (folder, layer, import direction): `architecture` in the
     ruleset config, for example `imports.forbid` with `from`, `to` and the
     message.
   - **Syntax** (call, literal, import): the ruleset's `lint-extra.cjs`, in
     `restrictedSyntax` (a `no-restricted-syntax` selector with the message) or
     in `configs` (e.g. `no-restricted-imports` with `importNames`).
   - **Behavior** that lint can't see: a test.
3. **Write a message that teaches:** what to do instead and where the right way
   lives ("import X from Y", "use the Z hook").
4. **Fix the existing code** to the right way, in the same PR. If there are many
   cases, the baseline freezes the old ones and new code is born correct;
   say how many were left.
5. **Prove the rule:** a case it rejects and the fixed code it accepts (run
   `quality-kit gate` and show both outputs).
6. **Hand the ruleset change to a human.** Changing the ruleset is a human
   decision: the gate fails with "the ruleset was changed" until someone runs
   `quality-kit rules accept` in a terminal.
   - **Local mode:** edit the ruleset files (`quality-kit paths`) and tell the
     person to review and run `quality-kit rules accept`.
   - **Team mode:** `.claude/settings.json` denies the agent edits to the
     ruleset. Save the change as a patch (`git diff` of what you would write) in
     a file outside the repo, and tell the person to apply, review and accept
     it. In the PR, the new ruleset needs the `regua-aprovada` label.

## Response

- The anti-pattern, the right way and the chosen rule (step and file).
- Both outputs from step 5.
- The fixed code and what was left frozen in the baseline.
- The command the human runs to accept.
