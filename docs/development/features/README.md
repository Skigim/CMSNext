# CMSNext Feature Delivery Workflow

This folder defines the CMSNext-native feature delivery workflow that sits beside the monthly roadmap and deeper design docs.

The goal is to turn roadmap intent into implementation-ready batches without introducing tool-specific branding or weakening architectural ownership.

## Purpose

Use this workflow when a feature is larger than a one-file change, spans layers, or needs a visible handoff path across triage, implementation, testing, and audit.

Use the existing monthly roadmap for scheduling and priority. Use the artifacts in this folder to move one feature from proposal to merged pull request.

## Artifact Tree

Feature work should live under a dated feature folder:

```text
docs/development/features/
  README.md
  templates/
    feature-spec.template.md
    phase-design.template.md
    task-plan.template.md
    alignment-report.template.md
  active/
    YYYY-MM-feature-slug/
      00-feature-spec.md
      01-phase-design.md
      02-task-plan.md
      03-alignment-report.md
  archive/
```

Recommended folder naming:

- `YYYY-MM-feature-slug` for a feature or milestone-sized body of work.
- Keep filenames ordered so the artifact sequence is obvious in file explorers and PR diffs.

## Artifact Roles

### `00-feature-spec.md`

Defines the user problem, scope, constraints, acceptance criteria, out-of-scope items, and architectural ownership.

This is the source document for feature intent.

### `01-phase-design.md`

Translates the spec into a phased technical design with explicit layer ownership, dependency ordering, and validation expectations.

Use this when the feature touches multiple layers, persistence rules, migrations, or significant UI flows.

### `02-task-plan.md`

Breaks the design into implementation batches that can be delegated to the existing CMSNext agents without crossing boundaries.

Each batch should be independently reviewable and validation-ready.

### `03-alignment-report.md`

Captures the pre-implementation or pre-batch alignment pass.

This is where triage, audit, or a feature owner records whether the spec, design, architecture, and validation model still agree before implementation begins or before a new batch starts. Include the task plan when alignment runs after batching work.

## Stage Workflow

### Stage 1: Roadmap Intake

- Input: active roadmap entry, bug cluster, or feature-catalogue gap.
- Owner: `triage`.
- Output: feature folder and initial `00-feature-spec.md`.
- Gate: problem statement, scope, layer ownership, and acceptance criteria are explicit.

### Stage 2: Feature Spec

- Primary owner: `triage`.
- Supporting reviewer: `audit` when the scope implies architecture, accessibility, storage, or release risk.
- Output: approved feature spec.
- Gate: no ambiguous ownership, no hidden backend assumptions, and no vague “do everything” task statements.

### Stage 3: Phase Design

- Primary owner depends on the center of gravity of the change:
  - `domain` for pure business rules and validation models.
  - `services` for orchestration and `DataManager` sequencing.
  - `storage` for persistence shape, migrations, file lifecycle, and autosave implications.
  - `hooks` for React workflow coordination.
  - `frontend` for rendering, interaction, and accessibility-sensitive UI.
- Secondary reviewers join only when the design truly crosses boundaries.
- Output: `01-phase-design.md`.
- Gate: data flow, invariants, and validation model are explicit.

### Stage 4: Alignment Pass

- Owner: `triage`.
- Oppositional reviewers: `audit` plus the most affected specialist if the design crosses layers.
- Output: `03-alignment-report.md`.
- Timing: run once after design to unblock task planning, then rerun after task planning when the batch plan materially changes scope or risk.
- Gate: the design still matches roadmap intent, layering rules, local-first assumptions, and current repo conventions.

### Stage 5: Task Planning

- Owner: `triage` with input from the primary implementation specialist.
- Output: `02-task-plan.md`.
- Gate: batches are ordered, bounded, and independently testable.

### Stage 6: Batch Implementation

- Owner: one primary specialist agent per batch.
- Supporting specialist: only when a batch cannot be kept within one ownership boundary.
- Output: code changes plus the minimal direct tests for that batch.
- Gate: each batch preserves the architecture `domain -> services/DataManager -> hooks -> components`.

### Stage 7: Review And Merge

- Primary reviewer: `audit` in oppositional-review mode.
- Supporting reviewer: `testing` when the batch crosses layers, changes shared utilities, adds accessibility-sensitive UI, or needs stronger regression coverage.
- Output: review findings, required fixes, final validation, merge-ready PR.
- Gate: tests, lint, typecheck, build, and manual checks match the change surface.

## Implementation Batching Rules

Batch work in dependency order. Prefer narrow, reviewable slices over large blended branches.

Default order:

1. Domain rules and types.
2. Service or storage orchestration.
3. Hook coordination.
4. UI components and interaction polish.
5. Cross-layer regression coverage and audit fixes.

Additional rules:

- Do not start UI-first when the data model or orchestration contract is still moving.
- Do not combine storage migrations and broad UI refactors in the same first batch.
- Keep each batch small enough that `audit` can review it against the original design without reconstructing the feature from scratch.
- If a feature needs a migration or storage invariant change, require a design artifact before the first implementation batch.
- If a batch forces cross-boundary edits, record why the split was not viable in `02-task-plan.md`.

## Dependency Ordering

Use these checks when ordering batches:

1. Schema or persisted-format decisions first.
2. Pure validation and transformation logic before service orchestration.
3. Service and `DataManager` contracts before hooks or UI consumers.
4. Hook interfaces before larger component refactors.
5. Audit and regression hardening before merge.

If the answer to any of these is still unknown, the feature is not ready to leave design.

## Bounded Refinement Loop

CMSNext already uses short-lived GitHub Flow branches. Refinement should fit that model instead of adding open-ended iteration.

Use this loop:

1. Draft or update the current artifact.
2. Run an alignment pass against the roadmap, feature catalogue, and current repo guidance.
3. Capture no more than three blocking deltas in the active artifact or alignment report.
4. Resolve those deltas before starting the next stage.
5. Re-run alignment at the next stage boundary.

Refinement stops when one of these is true:

- the current stage gate is met,
- the remaining unknowns are implementation details already owned by a specialist batch, or
- the feature should be split into a new roadmap item.

Refinement should not continue inside a PR once the issue is actually a correctness or regression problem. At that point, route to `testing` or `audit` and fix the issue directly.

## Handoff Model

Triage owns stage transitions and prepares implementation-ready handoffs.

Each handoff should name:

- the feature artifact folder,
- the exact batch being executed,
- the owning layer,
- files or areas expected to change,
- constraints to preserve,
- acceptance criteria,
- required validation.

Keep the primary owner singular whenever possible.

## PR Review Workflow

Use an oppositional-review model rather than a single “looks good” pass.

### Testing Pass

- Owner: `testing` when the batch crosses layers, changes shared utilities, adds accessibility-sensitive UI, or needs stronger regression coverage.
- Focus: failure modes, missing regression tests, weak assertions, mock quality, and validation gaps.

### Audit Pass

- Owner: `audit`.
- Focus: architecture drift, layering violations, accessibility risk, performance risk, storage safety, and mismatch between implementation and design artifacts.

### Merge Readiness

The PR is ready only when:

- findings from `testing` and `audit` are addressed or explicitly accepted,
- validation commands match the change scope,
- the feature artifact folder reflects the final delivered shape, and
- roadmap or catalogue references are updated when the feature meaningfully changes planned or delivered capability.

## Documentation Versus Automation

### Documentation Only Now

- Artifact folder structure and naming.
- Stage definitions and stage gates.
- Batch ordering and refinement rules.
- Oppositional PR review model.
- Handoff expectations for `triage`, specialists, `testing`, and `audit`.

### Candidate Future Automation

- A prompt or skill to scaffold a new feature artifact folder from the templates.
- A triage-oriented prompt to generate an alignment report from an existing spec and design.
- A PR review prompt that invokes `testing` and `audit` sequentially with the same acceptance criteria.
- Lightweight hooks or scripts that verify required artifacts exist for larger feature branches.

Do not add those automations until the documentation pattern is used enough times to prove the stable shape.

## Relationship To Existing Docs

- Monthly roadmaps decide sequencing and priority.
- Feature specs and designs in this folder turn roadmap items into implementation-ready work.
- The feature catalogue records delivered state and known gaps after work lands.
- `.github/copilot-instructions.md` and the scoped instruction files remain the source of truth for agent behavior and code constraints.

## Minimal Operating Checklist

Before implementation starts:

- feature folder exists,
- spec is written,
- design exists when the change is cross-layer or persistence-sensitive,
- alignment report confirms the plan still matches repo rules,
- task plan defines bounded batches and validation.

Before merge:

- specialist batch work is complete,
- `testing` and `audit` have reviewed when the change surface warrants it,
- validation is complete for the affected scope,
- roadmap or catalogue docs are updated if the feature materially changes planning or delivered capability.
