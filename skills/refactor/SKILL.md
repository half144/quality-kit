---
name: refactor
description: quality-kit refactoring playbook, picked by the task router. Use to extract, move, rename, split a large file, move a piece up to shared code, or pay down lint or type debt, without changing what the system does ("refactor", "extract", "split this file", "clean up", "move"). Lock in the behavior with characterization tests before touching anything and prove identical behavior afterwards.
---

# refactor

Copy these steps into the task list before you start (see `task`).
Refactoring is changing the shape without changing the behavior. A bug along the
way: note it and fix it later, through `bug-fix`.

1. **Lock in the current behavior** with characterization tests: pure function
   output for real and edge-case inputs, component render with what the person
   sees and clicks, backend return values. Typecheck and lint don't count. Green.
2. **Name the target shape:** what structure is missing and where each piece
   lives according to the ruleset. To fit a lint limit (300 lines, 80 per
   function, complexity 15), extract by responsibility, not by size.
3. **Subtract before you add:** delete dead code and duplication first.
   A new abstraction only with concrete repetition.
4. **Small steps, tests green at each one.** Migrate every caller and delete the
   old API in the same batch: no compatibility re-exports across folders. Moved
   code carries its own frozen debt; a new file is born clean.
5. **Prove identical behavior:** the same tests, without changing a single
   expectation. Affected screens go through `quality-kit verify --changed`.
6. **Verify:** `task/references/verification.md`. Measure the largest files you
   touched: no new giant file. The baseline shrinks on its own when you fix old
   debt; it never grows.
7. **Revert if it didn't get better.**

## Response

- The shape before and after, in one or two lines.
- The characterization tests and their output before and after.
- The callers migrated and what was deleted.
