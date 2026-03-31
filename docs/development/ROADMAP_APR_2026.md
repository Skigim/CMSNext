# CMSNext Roadmap - April 2026

**Report Date:** April 1, 2026  
**Branch:** main (stable)  
**Tests:** 1141/1141 passing ✅  
**Build:** Production-ready ✅  
**Average Feature Rating:** 85.5/100  
**Status:** Planned | v2.2 kickoff month | Intake & Application Layer

---

## ✅ Recent Completed Work (March carryover)

- [x] Shipped the persisted v2.1 workspace + archive migration path from Settings.
- [x] Wired `FileStorageService`, `DataManager`, and `CaseService` to hydrate normalized people data at runtime.
- [x] Added `PersonService` plus relationship-aware linked-person handling for normalized cases.
- [x] Expanded intake/edit workflow coverage for linked-person save payloads and existing-case updates.
- [ ] Complete the remaining March UI follow-through for case creation, household rendering, and linked-person updates.

---

## 🎯 April Objectives

1. **Finish the v2.1 UI Follow-Through** - Complete the remaining case-creation, household, and linked-person editing work from March so the normalized people/cases model is fully reflected in the UI.
2. **Begin v2.2: Intake & Application Layer** - Separate application lifecycle data from the long-lived case record and introduce a normalized `applications[]` collection.
3. **Establish Migration-Safe Foundations for v3.0** - Add new structures incrementally with explicit migration planning so the daily case-management workflow remains stable throughout the roadmap.

---

## 📅 Weekly Plan

### Week 1: Close Out March UI & Workflow Follow-Through (April 1-5)

#### Prep Work

- [ ] Audit all remaining create/edit surfaces that still assume embedded person payloads.
- [ ] Map all case creation, intake, and household rendering paths that need normalized people references.

#### Features

- [ ] Rework Case Creation Flow to search/reuse existing people before creating new records.
- [ ] Update `HouseholdTab` rendering to use relationship-driven and linked-person data natively.
- [ ] Ensure edits to a person propagate correctly across all linked cases and household views.

#### Refactoring & Polish

- [ ] Finalize unit testing for the normalized creation/edit pipelines.
- [ ] Resolve any remaining transitional assumptions tied to pre-v2.1 embedded person structures.

---

### Week 2: v2.2 Schema Design & Application Domain Planning (April 6-12)

#### Prep Work

- [ ] Design the `Application` entity and determine which intake/application fields must move out of `CaseRecord`.
- [ ] Define application status model and history requirements (`Received`, `Pending`, `Withdrawn`, `Approved`, `Denied`).
- [ ] Document migration rules from current case-embedded intake data into normalized application records.

#### Features

- [ ] Add `applications[]` to the persisted schema design for v2.2.
- [ ] Introduce `Application` and `ApplicationStatusHistory` TypeScript/domain types.
- [ ] Build initial migration utilities to derive normalized application records from existing v2.1 case data.

#### Refactoring & Polish

- [ ] Add tests for schema guards and migration helpers covering partial, missing, and legacy intake data.
- [ ] Review naming and field optionality to keep the v2.2 schema clean before UI wiring begins.

---

### Week 3: Application Service Layer & Persistence Wiring (April 13-19)

#### Prep Work

- [ ] Identify all `DataManager`, `CaseService`, and storage layer touchpoints that must recognize `applications[]`.
- [ ] Define hydration/dehydration expectations for application-linked runtime views.

#### Features

- [ ] Update storage interfaces to support persisted and runtime `applications[]`.
- [ ] Add `ApplicationService` for CRUD operations and status-history management.
- [ ] Wire `FileStorageService` and migration paths so v2.1 workspaces can safely upgrade to the new v2.2 structure.

#### Refactoring & Polish

- [ ] Add unit tests for `ApplicationService`, storage hydration, and migration validation.
- [ ] Ensure canonical read/write flows remain strict and migration-driven rather than silently mutating old files.

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

| Metric                                 | Start | Target |
| -------------------------------------- | ----- | ------ |
| Tests passing                          | 1141  | 1250+  |
| Remaining embedded-person UI paths     | Many  | 0      |
| v2.2 schema + migration design status  | 0%    | 100%   |
| Application service/storage wiring     | 0%    | 100%   |
| Average feature rating                 | 85.5  | 88+    |

---

## 🚫 Out of Scope (May+)

- Multi-program master-case / program-case separation
- Eligibility determination / rules engine (`ED` layer)

---

## 📚 Related Documents

- [March 2026 Roadmap](./ROADMAP_MAR_2026.md) - Previous month roadmap and v2.1 normalization follow-through
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
- **April target:** complete the remaining v2.1 UI follow-through and land the full v2.2 schema, migration, service-layer, and initial UI integration work in one month

### Quality Gates

Every feature must:

1. Pass all existing tests
2. Include tests for new functionality
3. Follow established service/storage patterns
4. Use explicit migration paths for persisted schema changes
5. Be documented in the feature catalogue or roadmap notes

### Recommended Next Step

Prioritize closing the remaining March UI gaps first, then lock the `Application` entity design early in April so the service layer, migration tooling, and intake UI can all move against a stable v2.2 target.

---

**Prepared by:** GitHub Copilot  
**Last updated:** March 27, 2026