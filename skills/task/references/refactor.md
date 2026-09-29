# The refactor playbook

Copy these steps into the task list after the plan's ok (step 3 of the `task` skill).
Refactoring is changing the shape without changing the behavior. A bug along the
way: note it and fix it later, through the [bug-fix playbook](bug-fix.md).

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
6. **Verify:** [the task skill's verification](verification.md). Measure the largest files you
   touched: no new giant file. The baseline shrinks on its own when you fix old
   debt; it never grows.
7. **Revert if it didn't get better.**

## Response

- The shape before and after, in one or two lines.
- The characterization tests and their output before and after.
- The callers migrated and what was deleted.
