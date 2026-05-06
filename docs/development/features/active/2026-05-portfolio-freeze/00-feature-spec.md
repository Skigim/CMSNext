# Feature Spec

## Header

- Feature: Portfolio Freeze
- Status: Draft
- Roadmap reference: Supersedes `docs/development/ROADMAP_APR_2026.md`; replacement status framing to live in `docs/development/PROJECT_STATUS.md`
- Owner: Project owner
- Primary specialization: documentation
- Related PRs: None yet

## Problem

CMSNext is no longer advancing on the April 2026 delivery roadmap. The project owner is leaving the role this application was built for, so the repository needs to transition from active product development to a stable portfolio artifact. The current roadmap still implies ongoing feature delivery, open follow-through, and future monthly sequencing that no longer reflect the intended direction.

This freeze must explicitly preserve the repository's current working state rather than introduce new scope. Today that state is strong and marketable: 1626 of 1626 tests are passing, the production build is green, the architecture remains cleanly layered as `domain -> services/DataManager -> hooks -> components`, and the project's average feature rating is 85.5 out of 100. The problem is not product failure; it is presentation drift between what the repository says is next and what the owner now wants the project to communicate.

This feature spec records that pivot. It also captures the exact roadmap archive note that should be inserted at the top of the April roadmap when that document is archived: `Archived May 2026: CMSNext is now frozen as a portfolio piece, and the remaining April roadmap items were intentionally not shipped.`

## Outcome

CMSNext is frozen in its current working state and presented as a polished, reviewer-oriented portfolio project. The repository ends this effort at `v1.0.0` with:

- roadmap language replaced by project-status language,
- repo and code hygiene checked one final time,
- reviewer-facing documentation that explains what the project is, why its technical decisions matter, and how to evaluate it quickly,
- and a deliberate record of what was intentionally left out of scope.

The freeze should make it easy for recruiters, hiring managers, and peer engineers to understand the value of the project without interpreting unfinished roadmap items as abandoned work.

## Scope

- In scope: Phase 1 `Stop cleanly` documentation work, including archiving the April roadmap with a closeout note, replacing roadmap-forward framing with a short project-status document, and reframing the portfolio-facing open items in `docs/development/feature-catalogue.md` as intentional `Known limitations` language instead of TODO-style forward commitments.
- In scope: Phase 1 decision capture for `docs/superpowers/specs/2026-04-10-remove-runtime-migration-tooling-design.md`, with the default recommendation recorded as `finish this cleanup because it reduces code surface and sharpens boundaries`, but with implementation blocked on explicit project-owner confirmation before Phase 1 begins.
- In scope: Phase 2 repository polish, including one `audit` pass for stray `console.*`, dead code, unused exports, and `TODO` or `FIXME` triage; one final validation gate on `main`; release tagging at `v1.0.0`; branch protection on `main`; and an explicit framing decision for `.github/agents/`, `.github/skills/`, vendored `skills/`, and `docs/superpowers/` with the expected supporting document `docs/AI_WORKFLOW.md`.
- In scope: Phase 3 presentation work, including a recruiter-oriented `README.md`, a portfolio case study at `docs/portfolio/CASE_STUDY.md`, a 60 to 90 second demo recording deliverable or recording script, and an optional lightweight SVG architecture diagram if it improves reviewer comprehension without expanding product scope.

## Out Of Scope

- Out of scope: Any new feature work, including small UX additions, backlog cleanup disguised as polish, or shipping any part of the April roadmap that is not already complete.
- Out of scope: Status-history UI, applicant reassignment, application timeline UI, widget personalization, month-view follow-through, or any other unshipped work referenced in `docs/development/ROADMAP_APR_2026.md`.
- Out of scope: Accessibility CI integration, new performance benchmarking initiatives, or refactoring work beyond direct fallout from approved audit fixes or an explicitly approved migration-tooling cleanup slice.
- Out of scope: Expanding the runtime migration-tooling cleanup beyond a bounded finishing slice if it proves larger than expected; in that case the freeze records the risk and defers the work instead of absorbing it.

## Architectural Ownership

- Primary layer: Documentation and repository presentation artifacts, with repo-health verification as a final release gate.
- Expected agent owner: documentation for the spec, README, project-status, archive note, AI workflow framing, and portfolio case study.
- Secondary concerns: audit for the one-time polish pass and release-readiness verification; storage only if the runtime migration-tooling cleanup is explicitly approved and remains a bounded shrink-the-surface change.

## Constraints To Preserve

- Local-first behavior only.
- Layered architecture: `domain -> services/DataManager -> hooks -> components`.
- Existing provider and storage contracts.
- Existing repo validation expectations.
- Preserve the current working health baseline: 1626 of 1626 tests passing, green production build, and no architecture drift introduced in the name of polish.
- Preserve the repo-memory rules in `.github/skills/repo-memories/references/repo-memories.md`, including no `console.*`, `cmsnext-*` localStorage naming, and strict persisted v2.2 storage expectations.
- Follow the bounded refinement loop in `docs/development/features/README.md`: at each artifact pass, capture no more than three blocking deltas, resolve them, and then advance.
- Do not let presentation work create implied future promises. Documentation should frame unshipped roadmap items as deliberate scope boundaries, not as deferred delivery commitments.

## Acceptance Criteria

- [ ] The feature spec explicitly records that the April 2026 roadmap no longer governs project direction and that CMSNext is being frozen as a portfolio project.
- [ ] Phase 1 acceptance: `docs/development/ROADMAP_APR_2026.md` is archived under `docs/development/archive/2026/` with a closeout note and the archive note text defined in this spec is added at the top when that archive step occurs.
- [ ] Phase 1 acceptance: `docs/development/PROJECT_STATUS.md` replaces roadmap-forward framing with a concise feature-complete-for-portfolio status statement.
- [ ] Phase 1 acceptance: `docs/development/feature-catalogue.md` no longer frames open work as `Gaps / Risks` to be scheduled, and instead presents remaining limits as intentional known limitations suitable for portfolio review.
- [ ] Phase 1 acceptance: the runtime migration-tooling cleanup has an explicit disposition before any implementation begins: approved as a bounded finishing slice, or deferred and documented in Risks and Open Questions without expanding freeze scope.
- [ ] Freeze execution does not move past the approved spec stage until the project owner reviews this artifact and explicitly confirms the Phase 1 starting decisions.
- [ ] Phase 2 acceptance: one `audit` pass triages stray `console.*`, dead code, unused exports, and `TODO` or `FIXME` items, and each finding is either removed, documented as intentionally retained, or deferred with rationale.
- [ ] Phase 2 acceptance: `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run build` all pass on `main` immediately before release tagging.
- [ ] Phase 2 acceptance: the repository is tagged `v1.0.0`, `main` branch protection is enabled, and the retained AI workflow scaffolding is framed intentionally through `docs/AI_WORKFLOW.md` or an approved alternative document.
- [ ] Phase 3 acceptance: `README.md` is rewritten for a human evaluator with a one-sentence pitch, visual preview, concise interest bullets, tech stack summary, and a clear `try it` path.
- [ ] Phase 3 acceptance: `docs/portfolio/CASE_STUDY.md` explains the key architectural and product decisions, including local-first design, canonical persisted v2.2 storage, and agent-driven development workflow, plus a short `what I'd do differently` section.
- [ ] Phase 3 acceptance: a 60 to 90 second demo asset exists in an agreed format, either as a recorded walkthrough or as a committed script that is ready to record, covering connect folder, unlock, intake a case, add a financial item with history, generate a case summary, and archive a case.
- [ ] Freeze completion does not start any new feature implementation and does not reopen the April roadmap as active product scope.

## Risks

- Risk: The runtime migration-tooling cleanup may be larger than the intended bounded finishing slice. If inspection shows hidden coupling or cross-layer churn beyond a tight shrink-the-surface change, the freeze should defer it and record that decision rather than quietly expanding scope.
- Risk: Reviewer-facing documentation may unintentionally read as contributor-heavy or tool-internal if the README, case study, and AI workflow framing are not rewritten with external evaluators as the primary audience.
- Risk: Branch protection and release tagging require repository administration outside normal file editing, so the freeze must verify ownership and access before treating those steps as complete.

## Validation Expectations

- Required commands: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`.
- Required manual checks: project-owner review of `README.md`, `docs/portfolio/CASE_STUDY.md`, and the final project-status framing; manual skim of the archived roadmap note and the reframed feature-catalogue limitations for tone and accuracy.
- Required regression coverage: no new feature coverage is expected from this spec alone, but any code touched during the audit or bounded cleanup work must preserve or update the minimal direct tests for the changed area and keep the full validation gate green.

## Open Questions

- Question: Should the runtime migration-tooling cleanup from `docs/superpowers/specs/2026-04-10-remove-runtime-migration-tooling-design.md` be executed as part of Phase 1, or should the freeze defer it to keep the portfolio scope tighter?
- Question: Is `docs/AI_WORKFLOW.md` the preferred framing document for the retained agent and skill scaffolding, or does the project owner want that explanation folded into `README.md` or the portfolio case study instead?
- Question: For Phase 3, does the project owner want a committed recording script only, or should the freeze require an actual captured demo before the release is considered complete?
