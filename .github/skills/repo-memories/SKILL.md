---
name: repo-memories
description: "Load concentrated CMSNext repository memory for architecture, storage, testing, naming, and workflow conventions. Use at the start of every CMSNext task, no matter how small, before deeper reasoning, code changes, reviews, or delegation."
argument-hint: "Describe the area you need reminders for, such as storage, hooks, testing, or naming conventions."
---

# CMSNext Repository Memory

Use this skill immediately after `skills/using-superpowers/SKILL.md` at the start of every CMSNext task so the agent refreshes the compact, high-signal version of repository conventions before implementing, reviewing, delegating, or even doing small read-only follow-up work.

## When To Use

- Always, immediately after `skills/using-superpowers/SKILL.md`, as the first repository-specific read step for CMSNext work.
- Before architecture reasoning, code edits, reviews, searches, or delegation.
- When you want the repo's naming, logging, storage, and workflow rules in one place.
- Before loading deeper guides for a specific layer.

## Procedure

1. Start every CMSNext task by loading `skills/using-superpowers/SKILL.md` before any reasoning, rationalization, or action.
2. Immediately after that, load the repository memory reference before deeper repo-specific reasoning or tool use.
3. Immediately after loading this skill, load `skill-governance` to choose the correct skill coverage for the next action.
4. If `skill-governance` identifies a more specific applicable skill, load and invoke it before taking that action, including read-only exploration, clarifying questions, delegation, planning, or implementation.
5. When workspace hooks are enabled, immediately record startup completion by running `node .github/hooks/scripts/mark-startup-complete.mjs <skill-name|none>` after the memory load, `skill-governance`, and any required Superpowers skill.
6. Treat every distinct action or tool batch as requiring skill coverage. `repo-memories` is the minimum baseline, but it does not excuse skipping a more specific skill when one applies.
7. At the start of each new phase, re-run `skill-governance` before continuing.
8. If the task touches a specific layer, load the matching guide from `.github/` after the memory reference and any required Superpowers skill.
9. Apply the rules as constraints while implementing, reviewing, or delegating.
10. When you learn a durable repo-specific convention, workflow rule, or recurring pitfall that is missing here, update the repository memory reference as part of the task closeout.
11. Use the repo-level validation commands before finishing substantial work.

## Superpowers Assumption

- CMSNext assumes Obra Superpowers is installed in the user environment.
- CMSNext also vendors the upstream Superpowers skill library under `skills/` for repo-local discovery and reference.
- Missing Obra Superpowers coverage for an action should be treated as a setup issue, not as permission to skip the skill workflow.

## Maintenance Rule

- Repository memory is not read-only documentation; keep it current when repo conventions, workflow expectations, or high-value pitfalls change.
- Prefer short, high-signal additions over broad narrative.
- Update the reference when a new rule should influence future tasks before deeper codebase exploration.

## References

- Repository memory reference
