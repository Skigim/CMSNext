# CMSNext Roadmap - March 2026

**Report Date:** March 2, 2026  
**Branch:** main (stable)  
**Tests:** 1141/1141 passing ✅  
**Build:** Production-ready ✅  
**Average Feature Rating:** 85.5/100  
**Status:** Archived on April 6, 2026 — superseded by the April 2026 roadmap  
**Archive Note:** Persisted v2.1 migration, normalized people hydration, and the create-time existing-person reuse plus household UI follow-through shipped ✅

**Milestone Update (March 19, 2026):** Persisted v2.1 migration, runtime hydration, and linked-person intake/save flows are complete ✅

---

## ✅ Recent Completed Work (March 19, 2026)

- [x] Shipped the persisted v2.1 workspace + archive migration path from Settings.
- [x] Wired `FileStorageService`, `DataManager`, and `CaseService` to hydrate normalized people data at runtime.
- [x] Added `PersonService` plus relationship-aware linked-person handling for normalized cases.
- [x] Expanded intake/edit workflow coverage for linked-person save payloads and existing-case updates.

---

## 🎯 March Objectives

1. **UX and Personalization** - Keyboard shortcut configuration shipped; dashboard widget personalization remains open.
2. **Database Normalization** - Global `people[]` storage, v2.1 migration, and explicit workspace/archive upgrade tooling are complete.
3. **Data Hydration & UI Overhaul** - Service-layer hydration is complete; the remaining work is the Week 4 UI follow-through for creation/edit and household views.

---

## 📅 Weekly Plan

### Week 1: Core UX and Personalization (March 2-8)

#### Prep Work

- [x] Fix any remaining bugs inherited from February.
- [x] Implement global anti-micro-drag logic to improve UI interactions.
- [ ] Run full audit cycle (performance and accessibility).

#### Features

- [x] Keyboard Shortcut Customization (Settings panel for rebinding).
- [ ] Dashboard widget personalization (show/hide, reorder).
- [ ] Virtual scrolling for 1k+ datasets.

#### Refactoring & Polish

- [x] Add unit tests for Week 1 features (Keyboard Shortcut Customizer test coverage met).
- [x] Ensure focus management in new modals (Verified accessible tab sequences in Settings hooks).

---

### Week 2: Data Model & Storage Refactoring (March 9-15)

#### Prep Work

- [x] Plan exact schema modifications for `Person` and `CaseRecord`.
- [x] Document hydration logic requirements for `DataManager`.

#### Features

- [x] Update `NormalizedFileData` to track `people: Person[]` globally.
- [x] Build v2.0-to-v2.1 storage migration to extract embedded people to the root array.
- [x] Create `PersonService` for independent people CRUD operations.

#### Refactoring & Polish

- [x] Add unit tests for `PersonService` and the migration handlers.
- [ ] Clean up redundant type properties during schema transitions.

---

### Week 3: Hydration & Service Layer Updates (March 16-22)

#### Prep Work

- [ ] Map out all consumers of `CaseDisplay` / `StoredCase` to prevent UI regressions.

#### Features

- [x] Modify `DataManager.ts` and `CaseService.ts` to hydrate Cases with People dynamically.
- [x] Update domain logic (`domain/cases/`) to handle uncoupled people patterns.
- [x] Enable robust relational linking inside the `Person` structure (spouses/dependents).

#### Refactoring & Polish

- [ ] Thoroughly test hydration and mapping performance.
- [x] Resolve any strict type-checking violations caused by schema changes.

---

### Week 4: UI & Workflow Overhaul (March 23-31)

#### Prep Work

- [ ] Identify all modal forms, creation pipelines, and tabs creating or editing `Person` records.

#### Features

- [ ] Rework Case Creation Flow: Search for existing person before creation, pass references instead of bodies.
- [ ] Update Household View (`HouseholdTab`) components to render family units from relational links natively.
- [ ] Ensure person updates reflect across all linked cases seamlessly.

#### Refactoring & Polish

- [ ] Finalize unit testing for the new data handling pipelines.
- [ ] Create March changelog.
- [ ] Update feature catalogue and finalize the April roadmap.

---

## 📊 Success Metrics

| Metric                        | Start | Target |
| ----------------------------- | ----- | ------ |
| Tests passing                 | 1141  | 1200+  |
| Components with anti-patterns | 0     | 0      |
| Hooks over 200 lines          | 0     | 0      |
| Average feature rating        | 85.5  | 87+    |

---

## 🚫 Out of Scope (April+)

- Real-time collaboration / multi-user features proper implementation
- Multi-device syncing functionality

---

## 📚 Related Documents

- [v2.1 Storage Design](../../v21-storage-design.md) - Schema and hydration design used for Weeks 2-3
- [February 2026 Roadmap](./ROADMAP_FEB_2026.md) - Archived previous month
- [Feature Catalogue](../../feature-catalogue.md) - Feature inventory pending next refresh

---

## 📝 Notes

### AI-Assisted Development Model

This roadmap reflects our accelerated development pace with direct AI assistance:

- **Traditional estimate:** 1-2 features per week
- **AI-assisted reality:** 3-4 features per week with full test coverage
- **Each week includes:** prep work, features, then refactoring/polish

### Quality Gates

Every feature must:

1. Pass all existing tests
2. Include tests for new functionality
3. Follow established patterns (hooks delegate to services)
4. Be documented in feature catalogue

### Recommended Next Step

The shipped March normalization work is now closed out. April should begin with the v2.2 application-model design slice so the schema, migration mapping, and domain vocabulary are settled before any service-layer or UI wiring begins.

---

**Prepared by:** GitHub Copilot  
**Last updated:** April 6, 2026 (Archived)
