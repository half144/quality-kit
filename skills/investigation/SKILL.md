---
name: investigation
description: "quality-kit investigation playbook: explain how the code works with file:line and runtime facts, changing nothing. Loaded by the task skill for a question about the code; start with task."
user-invocable: false
---

# investigation

For more than a one-look answer, copy these steps into the task list. There
is no tiny plan: nothing changes.
No file in the repo changes in this playbook. Running things to observe is fine;
editing is not. If the conclusion calls for a change, finish the explanation and
say which playbook comes next.

1. **Pin down the question** in one sentence, with what counts as an answer.
2. **Find the entry point:** the route, the screen map (the ruleset's
   `FEATURE_MAP.md`), the endpoint, the schema.
3. **Follow the data** from input to output, noting each stop with
   `file:line`.
4. **Confirm at runtime whatever is decisive.** Reading gives a hypothesis; a
   test, a query or the open screen give the fact. Label it: measured, inferred
   or guess.
5. **Read the history** when the why is not in the code: `git log -L`,
   `git log --follow`, the PR that introduced it.
6. **Verify** that `git status` is clean and that every `file:line` you cite
   exists.

## Response

- **How it works:** a two-line overview; the data path with `file:line`;
  where things live; the pitfalls.
- **Options:** a table with option, cost, risk and what each one breaks, and the
  recommendation with the reason.
