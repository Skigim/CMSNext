# CMSNext Roadmap - March 2026

**Report Date:** March 2, 2026  
**Branch:** main (stable)  
**Tests:** 1141/1141 passing ✅  
**Build:** Production-ready ✅  
**Average Feature Rating:** 85.5/100

---

## 🎯 March Objectives

1. **UX and Personalization** - Keyboard shortcut configuration, dashboard widgets.
2. **Database Normalization** - Decoupling `Person` entities from `Case` objects and instituting native relational storage for families and individuals.
3. **Data Hydration & UI Overhaul** - Restructuring the orchestrator and UI flows (like Case Creation and Household views) to support normalized people data.

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

- [ ] Add unit tests for Week 1 features.
- [ ] Ensure focus management in new modals.

---

### Week 2: Data Model & Storage Refactoring (March 9-15)

#### Prep Work

- [ ] Plan exact schema modifications for `Person` and `CaseRecord`.
- [ ] Diagram hydration logic requirements for `DataManager`.

#### Features

- [ ] Update `NormalizedFileData` to track `people: Person[]` globally.
- [ ] Build v2.0-to-v2.1 storage migration to extract embedded people to the root array.
- [ ] Create `PersonService` for independent people CRUD operations.

#### Refactoring & Polish

- [ ] Add unit tests for `PersonService` and the migration handlers.
- [ ] Clean up redundant type properties during schema transitions.

---

### Week 3: Hydration & Service Layer Updates (March 16-22)

#### Prep Work

- [ ] Map out all consumers of `CaseDisplay` / `StoredCase` to prevent UI regressions.

#### Features

- [ ] Modify `DataManager.ts` and `CaseService.ts` to hydrate Cases with People dynamically.
- [ ] Update domain logic (`domain/cases/`) to handle uncoupled people patterns.
- [ ] Enable robust relational linking inside the `Person` structure (spouses/dependents).

#### Refactoring & Polish

- [ ] Thoroughly test hydration and mapping performance.
- [ ] Resolve any strict type-checking violations caused by schema changes.

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

---

**Prepared by:** GitHub Copilot  
**Last updated:** March 2, 2026
