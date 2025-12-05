# CMSNext Roadmap - December 2025

**Report Date:** December 4, 2025  
**Branch:** main (stable)  
**Tests:** 326/326 passing ✅  
**Build:** Production-ready ✅  
**Average Feature Rating:** 78.5/100

---

## 🎯 December Objectives

1. **Code Quality** - Eliminate anti-patterns, enforce hook size limits
2. **Feature Completion** - Ship 6-10 new features across 3 weeks
3. **Testing & Polish** - Maintain 100% test pass rate, improve coverage

---

## 📅 Weekly Plan

### Week 1: Foundation & Financial Features (Dec 2-8) ✅ COMPLETE

#### Prep Work

- [x] Refactor 4 oversized hooks (useNavigationFlow, useConnectionFlow, useCaseManagement, useAlertsFlow)
- [x] Extract CaseOperationsService for business logic separation
- [x] PR #87 merged to main
- [x] FinancialItemModal refactor → `useFinancialItemFlow` hook
- [x] Fix Category Manager checkbox reset bug (countsAsCompleted)
- [x] Refactor NotesDrawer to use shadcn Drawer component (was custom CSS transform implementation)

#### Features

- [x] AVS Import UI in Financials tab
- [x] Bulk case list actions (multi-select delete/status change)
- [x] Filter/sort persistence with localStorage and reset button
- [x] Navigate to case details after creating new case
- [x] Skeleton case auto-creation from unmatched alert imports (with proper name casing)
- [x] Dashboard cleanup - removed AlertCenter and RecentCases widgets (Activity Log only)
- [x] Refresh Case Summary Generator with configurable section modal and plain-text export
- [x] Click-to-copy on financial cards (uses same format as Case Summary)
- [x] Financial card UX: show copy/delete on hover, status dropdown outside click area, auto-save status

#### Refactoring & Polish

- [x] Update feature catalogue with new features
- [x] All features committed and merged to main
- [x] 326 tests passing
- [x] Phone number formatting in Case Summary Generator
- [x] Financial card layout fixes (CSS grid, CardHeader override)

**⏸️ FEATURE FREEZE: Dec 5-8 is polish time. No new features until Week 2.**

---

### Week 2: Reporting & Analytics (Dec 9-15)

#### Prep Work

- [ ] Fix any bugs discovered from Week 1 features

#### Features

- [ ] Case timeline view (activity log visualization)
- [ ] Dashboard widget: Cases by age distribution
- [ ] Historical financial tracking (amount history modal with dated entries + verification per entry)

#### Refactoring & Polish

- [ ] Add unit tests for Week 2 features
- [ ] Accessibility audit (jest-axe) for new components

---

### Week 3: UX Improvements & Automation (Dec 16-22)

#### Prep Work

- [ ] Address any accessibility issues from Week 2 audit
- [ ] Fix bugs discovered from Week 2 features
- [ ] Plan feature implementation approach

#### Features

- [ ] Keyboard shortcuts for common actions
- [ ] Case templates for quick creation
- [ ] Alert auto-assignment based on MCN matching
- [ ] Notes search/filter functionality

#### Refactoring & Polish

- [ ] Add unit tests for Week 3 features
- [ ] Refactor Settings.tsx (675 lines) - extract to hooks (`useDataPurge`, `useAlertsCsvImport`)
- [ ] Optimize large case list rendering
- [ ] Clean up deprecated code paths
- [ ] Create December changelog
- [ ] Update feature catalogue ratings
- [ ] Plan January roadmap

---

### Week 4: Holiday Break (Dec 23-31) 🎄

**Off** - No planned development. Emergency fixes only if needed.

---

## 📊 Success Metrics

| Metric                        | Start | Week 1 | Week 2 | Week 3 | Target |
| ----------------------------- | ----- | ------ | ------ | ------ | ------ |
| Hooks over 200 lines          | 4     | 0 ✅   | 0      | 0      | 0      |
| Components with anti-patterns | 1     | 0 ✅   | 0      | 0      | 0      |
| Test count                    | 253   | 326 ✅ | 335    | 345    | 345+   |
| New features shipped          | -     | 12 ✅  | 4      | 4      | 20     |
| Average feature rating        | 76.5  | 78.5   | 79     | 80     | 80+    |

---

## 🔴 Priority by Week

### Week 1 - P0 ✅ ALL COMPLETE

1. ~~Hook refactoring~~ ✅
2. ~~FinancialItemModal anti-pattern fix~~ ✅
3. ~~Category Manager checkbox bug~~ ✅
4. ~~Bulk case list actions~~ ✅
5. ~~Filter/sort persistence~~ ✅
6. ~~Navigate to case details after new case~~ ✅
7. ~~Skeleton case creation from alerts~~ ✅
8. ~~Dashboard widget cleanup~~ ✅
9. ~~Case Summary Generator with modal~~ ✅
10. ~~Financial card copy button~~ ✅
11. ~~Financial card UX polish~~ ✅
12. ~~Phone number formatting~~ ✅

### Week 2 - P0

1. Case timeline view
2. Export functionality
3. Dashboard analytics widget
4. Financial summary report

### Week 3 - P0

1. Keyboard shortcuts
2. Case templates
3. Alert auto-assignment
4. Notes search

---

## 🚫 Out of Scope (January+)

- Visual regression testing setup
- Release automation
- Real-time collaboration
- Mobile responsive overhaul
- Multi-user support

---

## 📝 Notes

### AI-Assisted Development Model

This roadmap reflects our accelerated development pace with direct AI assistance:

- **Traditional estimate:** 1-2 features per week
- **AI-assisted reality:** 4+ features per week with full test coverage
- **Each week includes:** prep work, features, then refactoring/polish

### Quality Gates

Every feature must:

1. Pass all existing tests
2. Include tests for new functionality
3. Follow established patterns (hooks delegate to services)
4. Be documented in feature catalogue

---

**Prepared by:** GitHub Copilot  
**Last updated:** December 4, 2025
