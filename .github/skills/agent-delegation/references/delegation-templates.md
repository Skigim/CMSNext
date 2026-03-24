# CMSNext Delegation Templates

## Research Task

```text
TASK: Research only. Do not make changes.

Inspect the relevant repo guidance first.

Find all code related to [PATTERN OR FEATURE].

Return:
1. The relevant files
2. The current pattern being used
3. Any inconsistencies or risks
4. The best candidate files for a follow-up change
```

## Audit Task

```text
TASK: Perform a focused audit. Do not make changes unless I explicitly ask.

Scope:
- Area: [FEATURE OR FILE SET]
- Checks: [CORRECTNESS, ACCESSIBILITY, SECURITY, PERFORMANCE, ARCHITECTURE]

Return findings ordered by severity with file references, concrete risk, and recommended next action.
```

## Implementation Task

```text
TASK: Implement the change directly.

Read the relevant repo instructions first.

Target:
- Files or area: [FILES]
- Goal: [CHANGE]
- Constraints: [CONSTRAINTS]

Return a concise summary of what changed, validation run, and any remaining risks.
```

## Agent Selection Guide

```text
Choose the most specific agent that matches the center of gravity of the task:

- audit: reviews, regressions, security, accessibility, performance, release readiness
- frontend: React components, styling, interaction flows, accessibility-sensitive UI work
- domain: pure business rules, calculations, validation, transformations
- hooks: custom hook design, React state orchestration, effect and callback issues
- services: DataManager and service orchestration, read-modify-write flows, activity logging
- storage: File System Access API, autosave, file handles, persistence bugs and migrations
- testing: Vitest, React Testing Library, jest-axe, failures, coverage gaps
- Explore: broad read-only discovery when the right files or code paths are not clear yet
```
