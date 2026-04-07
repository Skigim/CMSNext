# CMSNext Roadmap - April 2026

**Report Date:** April 1, 2026  
**Branch:** main (stable)  
**Tests:** 1141/1141 passing ✅  
**Build:** Production-ready ✅  
**Average Feature Rating:** 85.5/100  
**Status:** In progress | Week 2A domain slice landed | Intake & Application Layer

---

## ✅ Recent Completed Work (March carryover)

- [x] Shipped the persisted v2.1 workspace + archive migration path from Settings.
- [x] Wired `FileStorageService`, `DataManager`, and `CaseService` to hydrate normalized people data at runtime.
- [x] Added `PersonService` plus relationship-aware linked-person handling for normalized cases.
- [x] Expanded intake/edit workflow coverage for linked-person save payloads and existing-case updates.
- [x] Landed create-time existing-person reuse plus relationship-driven household rendering in the intake and case-details UI.
- [x] Landed the Week 2A application-domain foundation: `Application`/`ApplicationStatusHistory` types, migration field ownership rules, and initial migration helpers/tests.
- [ ] Decide whether intake edit should support applicant reassignment to a different existing person or document the current limitation as intentional.

---

## 🎯 April Objectives

1. **Close the v2.1 UI Follow-Through** - Update docs to reflect the shipped normalized people UI work and decide whether edit-time applicant reassignment is still a required follow-up.
2. **Begin v2.2: Intake & Application Layer** - Separate application lifecycle data from the long-lived case record and introduce a normalized `applications[]` collection.
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

Status on `feat/application-domain-week2a`: the domain/model slice is landed; storage persistence, `DataManager`/service wiring, and UI integration remain downstream.

- [x] Lock the `Application` entity boundary before touching storage wiring or UI flows.
- [x] Define `ApplicationStatusHistory` as the canonical status timeline model for v2.2.
- [x] Map current case-embedded intake/application fields into normalized `applications[]` records.
- [x] Capture naming, ownership, and optionality decisions in docs before Week 3 service work begins.

#### Prep Work

- [x] Design the `Application` entity and determine which intake/application fields must move out of `CaseRecord`.
- [x] Define application status model and history requirements (`Received`, `Pending`, `Withdrawn`, `Approved`, `Denied`).
- [x] Document migration rules from current case-embedded intake data into normalized application records.

#### Features

- [ ] Add `applications[]` to the persisted schema design for v2.2.
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
- [x] Wire `FileStorageService` and migration paths so v2.1 workspaces can safely load optional `applications[]` support while keeping the persisted v2.1 storage shape.

#### Refactoring & Polish

- [x] Add unit tests for `ApplicationService`, storage hydration, and migration validation.
- [x] Ensure canonical read/write flows remain strict and migration-driven rather than silently mutating old files.

---

### Week 4: Intake UI Integration & Roadmap Handoff (April 20-30)

#### Prep Work

- [ ] Identify all intake forms, tabs, and workflows that should read/write `Application` records instead of overloading `CaseRecord`.
- [ ] Define the minimum viable UI for application status tracking in the single-program workflow.

#### Features

- [ ] Update intake flows to create or update normalized application records alongside cases.
- [ ] Add application status history rendering in the UI.
- [ ] Ensure case views clearly distinguish ongoing case data from application-event data.

#### Refactoring & Polish

- [ ] Finalize tests for end-to-end create/edit/migrate scenarios involving `applications[]`.
- [ ] Create April changelog.
- [ ] Update feature catalogue and draft the May roadmap (expected v2.3 verification/task focus).

---

## 📊 Success Metrics

| Metric                                 | Start | Target          |
| -------------------------------------- | ----- | --------------- |
| Tests passing                          | 1141  | 1250+           |
| Remaining verified v2.1 UI limitations | 1     | 0 or documented |
| v2.2 schema + migration design status  | 0%    | 100%            |
| Application service/storage wiring     | 0%    | 100%            |
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
- **April target:** close out the remaining v2.1 documentation and decision work, land the Week 2A application-domain foundation, then finish the v2.2 storage, service-layer, and initial UI integration slices

### Quality Gates

Every feature must:

1. Pass all existing tests
2. Include tests for new functionality
3. Follow established service/storage patterns
4. Use explicit migration paths for persisted schema changes
5. Be documented in the feature catalogue or roadmap notes

### Recommended Next Step

Carry the landed Week 2A domain slice into Week 3 by wiring persisted `applications[]` support through storage, `DataManager`, and the service layer before any intake/UI changes begin.

---

**Prepared by:** GitHub Copilot  
**Last updated:** April 7, 2026
