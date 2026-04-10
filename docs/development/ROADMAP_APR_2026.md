# CMSNext Roadmap - April 2026

**Report Date:** April 1, 2026  
**Branch:** main (stable)  
**Tests:** 1626/1626 passing ✅  
**Build:** Production-ready ✅  
**Average Feature Rating:** 85.5/100  
**Status:** In progress | Canonical intake ownership landed | Intake & Application Layer

---

## ✅ Recent Completed Work (March carryover + April progress)

- [x] Removed runtime workspace + archive migration tooling and made runtime support strict persisted v2.2-only.
- [x] Wired `FileStorageService`, `DataManager`, and `CaseService` to hydrate normalized people data at runtime.
- [x] Added `PersonService` plus relationship-aware linked-person handling for normalized cases.
- [x] Expanded intake/edit workflow coverage for linked-person save payloads and existing-case updates.
- [x] Landed create-time existing-person reuse plus relationship-driven household rendering in the intake and case-details UI.
- [x] Landed the Week 2A application-domain foundation: `Application`/`ApplicationStatusHistory` types, migration field ownership rules, and initial migration helpers/tests.
- [x] Moved intake create/edit onto canonical `applications[]` ownership with deterministic oldest-non-terminal selection, status-history synchronization, and locked non-intake application fields on the live case-edit surface.
- [ ] Decide whether intake edit should support applicant reassignment to a different existing person or document the current limitation as intentional.

---

## 🎯 April Objectives

1. **Close the v2.1 UI Follow-Through** - Update docs to reflect the shipped normalized people UI work and decide whether edit-time applicant reassignment is still a required follow-up.
2. **Advance v2.2: Intake & Application Layer** - Keep application lifecycle data in normalized `applications[]`, complete the remaining status-history UI work, and reduce reliance on compatibility mirrors.
3. **Establish Migration-Safe Foundations for v3.0** - Add new structures incrementally with explicit migration planning so the daily case-management workflow remains stable throughout the roadmap.

---

## 📅 Weekly Plan

### Week 1: Close Out March UI & Workflow Follow-Through (April 1-5)

#### Prep Work

- [x] Audit the create/edit surfaces that previously assumed embedded person payloads.
- [x] Verify the intake, case-details, and household rendering paths against the normalized people model and current tests.

#### Features

- [x] Rework case creation so intake can search for and reuse existing people before creating new records.
- [x] Update the household rendering surfaces to use relationship-driven and linked-person data natively.
- [ ] Decide whether intake edit should support reassigning the primary applicant to a different existing person.

#### Refactoring & Polish

- [x] Finalize targeted test coverage for normalized creation, reuse, and household rendering pipelines.
- [ ] Add a direct regression test for cross-case shared-person propagation if we want explicit proof beyond the current shared-registry write path.

---

### Week 2: v2.2 Schema Design & Application Domain Planning (April 6-12)

#### First Clean Slice: Week 2A - Application Model & Migration Design

Status on `feat/application-domain-week2a`: the domain/model slice is landed, the downstream storage persistence plus `DataManager`/service wiring have merged, and canonical intake ownership is now live. Remaining UI work is status-history surfacing and compatibility cleanup.

- [x] Lock the `Application` entity boundary before touching storage wiring or UI flows.
- [x] Define `ApplicationStatusHistory` as the canonical status timeline model for v2.2.
- [x] Map current case-embedded intake/application fields into normalized `applications[]` records.
- [x] Capture naming, ownership, and optionality decisions in docs before Week 3 service work begins.

#### Prep Work

- [x] Design the `Application` entity and determine which intake/application fields must move out of `CaseRecord`.
- [x] Define application status model and history requirements (`Received`, `Pending`, `Withdrawn`, `Approved`, `Denied`).
- [x] Document migration rules from current case-embedded intake data into normalized application records.

#### Features

- [x] Add `applications[]` to the persisted schema design for v2.2.
- [x] Introduce `Application` and `ApplicationStatusHistory` TypeScript/domain types.
- [x] Build initial migration utilities to derive normalized application records from existing v2.1 case data.

#### Refactoring & Polish

- [x] Add initial tests for migration helpers covering field ownership, defaults, and conservative status derivation.
- [x] Review naming and field optionality to keep the v2.2 schema clean before UI wiring begins.
- [ ] Revisit whether the intermediate application migration snapshot should adopt the final normalized verification field names; keep that cleanup out of the landed Week 2A slice unless we intentionally remove the current legacy-extraction seam later this week.
- [ ] Extend coverage to persisted schema guards and broader partial/legacy intake edge cases once storage wiring begins.

---

### Week 3: Application Service Layer & Persistence Wiring (April 13-19)

#### Prep Work

- [x] Identify all `DataManager`, `CaseService`, and storage layer touchpoints that must recognize `applications[]`.
- [x] Define hydration/dehydration expectations for application-linked runtime views.

#### Features

- [x] Update storage interfaces to support persisted and runtime `applications[]`.
- [x] Add `ApplicationService` for CRUD operations and status-history management.
- [x] Wire `FileStorageService` and storage helpers so canonical persisted v2.2 workspaces can carry optional `applications[]` support without runtime migration.

#### Refactoring & Polish

- [x] Add unit tests for `ApplicationService`, storage hydration, and migration validation.
- [x] Ensure canonical read/write flows remain strict and migration-driven rather than silently mutating old files.

---

### Week 4: Intake UI Integration & Roadmap Handoff (April 20-30)

#### Prep Work

- [x] Identify all intake forms, tabs, and workflows that should read/write `Application` records instead of overloading `CaseRecord`.
- [ ] Define the minimum viable UI for application status tracking in the single-program workflow.

#### Features

- [x] Update intake flows to create or update normalized application records alongside cases.
- [x] Lock non-intake application-owned fields on the live case-edit surface while compatibility reads remain in place.
- [ ] Add application status history rendering in the UI.
- [ ] Ensure case views clearly distinguish ongoing case data from application-event data.

#### Refactoring & Polish

- [x] Expand storage/service/hook/component regression coverage for canonical application ownership, deterministic selection, and status synchronization.
- [ ] Finalize tests for end-to-end create/edit/migrate scenarios involving `applications[]`.
- [ ] Create April changelog.
- [ ] Update feature catalogue and draft the May roadmap (expected v2.3 verification/task focus).

---

## 📊 Success Metrics

| Metric                                 | Start | Target          |
| -------------------------------------- | ----- | --------------- |
| Tests passing                          | 1626  | 1700+           |
| Remaining verified v2.1 UI limitations | 1     | 0 or documented |
| v2.2 schema + migration design status  | 0%    | 100%            |
| Application service/storage wiring     | 100%  | 100%            |
| Average feature rating                 | 85.5  | 88+             |

---

## 🚫 Out of Scope (May+)

- Multi-program master-case / program-case separation
- Eligibility determination / rules engine (`ED` layer)

---

## 📚 Related Documents

- [March 2026 Roadmap](./archive/2026/ROADMAP_MAR_2026.md) - Archived previous month roadmap and v2.1 normalization follow-through
- [v2.1 Storage Design](./v21-storage-design.md) - Normalized storage and hydration design foundation
- [Feature Catalogue](./feature-catalogue.md) - Feature inventory pending next refresh

---

## 📝 Notes

### April Theme: v2.2 Intake & Application Layer

April begins the first post-v2.1 schema evolution step:

- **v2.1 focus:** normalized people/cases/financials/notes/alerts tracking shell
- **v2.2 focus:** separate application lifecycle from the ongoing case
- **Result:** a single case can support multiple application events over time without overloading `CaseRecord`

This is the first intentional step toward the longer v3.0 single-program platform roadmap:

- v2.2 — applications
- v2.3 — verification requests and tasks
- v2.4 — deep evidence (income/assets/expenses)
- v2.5 — organizations, correspondence, and audit
- v2.6 — temporal state and household history
- v3.0 — schema lockdown and optimization

### AI-Assisted Development Model

This roadmap reflects our accelerated development pace with direct AI assistance:

- **Traditional estimate:** 1-2 features per week
- **AI-assisted reality:** 3-4 features per week with full test coverage
- **April target:** close out the remaining v2.1 documentation and decision work, reflect the landed v2.2 application-domain, storage/service, and canonical-intake ownership slices accurately, then finish status-history UI and compatibility cleanup

### Quality Gates

Every feature must:

1. Pass all existing tests
2. Include tests for new functionality
3. Follow established service/storage patterns
4. Use explicit migration paths for persisted schema changes
5. Be documented in the feature catalogue or roadmap notes

### Recommended Next Step

Follow the canonical-intake ownership cleanup with the surfacing slice: add application status-history rendering and decide how case-detail surfaces should present the selected canonical application data now that legacy migration-on-save and read-time application rewrites have been removed from the normal runtime path.

---

**Prepared by:** GitHub Copilot  
**Last updated:** April 9, 2026
