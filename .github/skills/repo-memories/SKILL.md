---
name: repo-memories
description: "Load concentrated CMSNext repository memory for architecture, storage, testing, naming, and workflow conventions. Use at the start of every CMSNext task, no matter how small, before deeper reasoning, code changes, reviews, or delegation."
argument-hint: "Describe the area you need reminders for, such as storage, hooks, testing, or naming conventions."
---

# CMSNext Repository Memory

Use this skill at the start of every CMSNext task so the agent refreshes the compact, high-signal version of repository conventions before implementing, reviewing, delegating, or even doing small read-only follow-up work.

## When To Use

- Always, as the first repository-specific read step for CMSNext work.
- Before architecture reasoning, code edits, reviews, searches, or delegation.
- When you want the repo's naming, logging, storage, and workflow rules in one place.
- Before loading deeper guides for a specific layer.

## Procedure

1. Start every CMSNext task by loading the repository memory reference before deeper reasoning or tool use.
2. Immediately after loading this skill, check whether any installed Superpowers skill applies to the task and, if one does, load and invoke it before taking any other action, including read-only exploration, clarifying questions, delegation, planning, or implementation.
3. When workspace hooks are enabled, immediately record startup completion by running `node .github/hooks/scripts/mark-startup-complete.mjs <skill-name|none>` after the memory load and any required Superpowers skill.
4. If the task touches a specific layer, load the matching guide from `.github/` after the memory reference and any required Superpowers skill.
5. Apply the rules as constraints while implementing, reviewing, or delegating.
6. When you learn a durable repo-specific convention, workflow rule, or recurring pitfall that is missing here, update the repository memory reference as part of the task closeout.
7. Use the repo-level validation commands before finishing substantial work.

## Maintenance Rule

- Repository memory is not read-only documentation; keep it current when repo conventions, workflow expectations, or high-value pitfalls change.
- Prefer short, high-signal additions over broad narrative.
- Update the reference when a new rule should influence future tasks before deeper codebase exploration.

## References

- Repository memory reference
