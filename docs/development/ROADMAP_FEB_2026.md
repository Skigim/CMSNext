# CMSNext Roadmap - February 2026

**Report Date:** February 3, 2026  
**Branch:** main  
**Focus:** Audit Remediation + Archive Completion + UX Improvements  
**Status:** Week 1 In Progress

---

## 🎯 February Objectives

1. **Audit Remediation** - Clear all High/Medium priority findings from January audits
2. **Archive System Completion** - Restore from archive, activity log rotation
3. **Saved Filter Views** - Power user workflow improvement for Case List
4. **Keyboard Navigation** - Implement `Ctrl+G` chord system

---

## 📅 Weekly Plan

### Week 1: Audit Cleanup Sprint (Feb 2-8)

_Focus: Clear ALL outstanding audit items from January_

#### High Priority - Security Audit

- [x] **AVS Duplicate Detection Error Handling** - ✅ Fixed halts import on failure (useAVSImportFlow.ts)
- [x] **File Storage Silent Load Failures** - ✅ Already fixed (commit 8b2da4c) - aggregates errors and shows warning toast
- [x] **Template Reorder Optimistic UI** - ✅ Already fixed (commit 8b2da4c) - shows toast.error on failure
- [x] **Encryption Auth Error Specificity** - ✅ Fixed with typed EncryptionError (EncryptionContext.tsx)

#### High Priority - Hooks Audit (Console Statements)

- [x] Replace 22 `console.error`/`console.warn` with logger utility (8 files): ✅ **COMPLETE**
  - [x] `useAVSImportFlow.ts` - Already had logger, verified
  - [x] `useAlertsCsvImport.ts` (1 error)
  - [x] `useFinancialItems.ts` (1 error)
  - [x] `useBulkNoteFlow.ts` (1 error) - Found during audit
  - [x] `useCaseActivityLog.ts` (1 error) - Already had logger
  - [x] `useNotes.ts` (5 errors)
  - [x] `useNoteFlow.ts` (4 errors, 1 warn)
  - [x] `useFinancialItemFlow.ts` (6 errors)
  - [x] `useNavigationActions.ts` (2 errors)
  - Note: `useAlertListPreferences.ts` and `useCaseListPreferences.ts` only had console.log in JSDoc examples (acceptable)

#### Medium Priority - UI Audit

- [x] **Extract `getCategoryColor` utility** - ✅ Already exists as `getStaticNoteCategoryColor` in `utils/styleUtils.ts`
- [x] **Create `requireDataManager()` helper** - ✅ Already exists as `guardDataManager` in `utils/guardUtils.ts`
- [x] **Refactor category update handlers** - ✅ Extracted `withCategoryUpdate` helper, migrated 8 try/catch blocks
- [x] **Standardize widget loading skeletons** - ✅ Created `WidgetSkeleton` and `WidgetError` components, updated 7 widgets

#### Low Priority - UI Audit

- [ ] **Activity Log Unbounded Growth** - Implement auto-archiving/rotation policy
- [ ] **Synchronous AVS Parsing** - Move to worker or use chunking for large inputs
- [ ] **Rename vague variables** - `result`, `data`, `selected` → descriptive names
- [x] **Standardize `error` vs `err`** - ✅ Migrated 19 instances to `catch (error)` pattern
- [x] **Move `US_STATES` to shared constants** - ✅ Created `domain/common/usStates.ts`
- [x] **Move `colorPalette` to module-level constant** - ✅ NotesSection.tsx no longer exists (refactored)
- [ ] **Consolidate Error Boundary base class** - Create `BaseErrorBoundary` or use library

#### Paper Cuts (Added Feb 6)

- [ ] **Better Focus Lock in Financial Item Modal** - Improve focus trap/tab navigation within the financial item modal dialog
- [ ] **Add Apt Field to Address Schema** - Add apartment/unit field to address validation schema
- [ ] **Archive Panel Search Bar** - Add search/filter bar to the archival panel in Settings
- [ ] **Tune AVS Import Current Item Matching** - Refine matching logic for AVS Import → Current Item flow

#### Refactoring & Polish

- [x] Add tests for new utilities (`requireDataManager`, `getCategoryColor`) - N/A (already exist with tests)
- [x] Update audit reports to mark items complete - ✅ UI_AUDIT_REPORT.md updated
- [x] Verify build and all tests pass - ✅ 1118 tests passing

---

### Week 2: Archive & Data Lifecycle (Feb 9-15)

_Focus: Complete archive system and data management improvements_

#### Prep Work

- [ ] Fix any bugs discovered from Week 1
- [ ] Design restore-from-archive UX flow

#### Features

- [ ] **Restore from Archive** - Bring archived cases back to active file
- [ ] **Search within Archives** - Filter/search loaded archive files
- [ ] **Archive File Metadata** - Display creation date, case count in UI
- [ ] **Activity Log Auto-Archiving** - Rotate old entries to archive files

#### Refactoring & Polish

- [ ] Add tests for restore operations
- [ ] Performance benchmark large archive loads
- [ ] Update Case Archival feature catalogue rating

---

### Week 3: UX & Power User Features (Feb 16-22)

_Focus: Keyboard navigation and saved filters_

#### Prep Work

- [ ] Fix any bugs from Week 2
- [ ] Document current keyboard shortcut coverage

#### Features

- [ ] **Chord Navigation** - `Ctrl+G` leader key → `D` (dashboard), `L` (list), `S` (settings)
- [ ] **Keyboard Shortcut Customization** - Settings panel for rebinding
- [ ] **Saved Filter Views** - User-configurable filter presets in Case List
- [ ] **Quick-Switch Filters** - Buttons for saved view presets

#### Refactoring & Polish

- [ ] Add keyboard navigation tests
- [ ] Accessibility verification for new features
- [ ] Update Developer Enablement feature catalogue

---

### Week 4: Polish & Planning (Feb 23-28)

_Focus: Final polish and March planning_

#### Prep Work

- [ ] Fix bugs from Weeks 1-3
- [ ] Run full audit cycle

#### Features

- [ ] **Relationship Search** - Filter/search by relationship data in Case List
- [ ] **Export Filter Presets** - Share saved views between installations
- [ ] Address any remaining low-priority items

#### Refactoring & Polish

- [ ] Create February changelog
- [ ] Update feature catalogue ratings
- [ ] Plan March roadmap
- [ ] Archive February roadmap

---

## 📊 Success Metrics

| Metric                      | Start | Week 1 | Week 2 | Week 3 | Target |
| --------------------------- | ----- | ------ | ------ | ------ | ------ |
| Test count                  | 1118  | 1118   |        |        | 1200+  |
| Average feature rating      | 85.1  |        |        |        | 87+    |
| Open audit findings         | 18    | 17     |        |        | 0      |
| Console statements in hooks | 22    | 0 ✅   |        |        | 0      |
| Case Archival rating        | 82    |        |        |        | 88     |
| New features shipped        | -     |        |        |        | 10-12  |

---

## 🔴 Priority by Week

### Week 1 - P0 (Audit Remediation)

1. Console.error/warn → logger migration (26 occurrences, 10 files)
2. Security audit error handling fixes (4 findings)
3. UI audit utility extractions (4 patterns)
4. Low-priority cleanups (7 items)

### Week 2 - P0 (Archive Completion)

1. Restore from archive
2. Activity log auto-archiving
3. Archive search/filter
4. Archive metadata display

### Week 3 - P0 (UX Features)

1. Chord keyboard navigation
2. Saved filter views
3. Shortcut customization
4. Quick-switch filter buttons

---

## 🚫 Out of Scope (March+)

- Dashboard widget personalization (show/hide, reorder)
- Real-time collaboration / multi-user features
- PDF/CSV export for case summaries
- Conditional template logic (if/else blocks)
- Non-Chromium browser progressive enhancement
- Virtual scrolling for 1k+ datasets

---

## 📚 Related Documents

- [Feature Catalogue](feature-catalogue.md) - Complete feature inventory
- [January 2026 Roadmap](archive/2026/ROADMAP_JAN_2026.md) - Previous month
- [UI Audit Report](../audit/UI_AUDIT_REPORT.md) - Outstanding UI items
- [Hooks Audit](../audit/HOOKS_AUDIT.md) - Console statement findings
- [Security Audit](../audit/SECURITY_AUDIT.md) - Error handling findings

---

_Last updated: February 3, 2026_
