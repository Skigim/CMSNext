# CMSNext Roadmap - December 2025

**Report Date:** December 3, 2025  
**Branch:** main (stable)  
**Tests:** 282/282 passing ✅  
**Build:** Production-ready ✅  
**Average Feature Rating:** 77.1/100

---

## 🎯 December Objectives

1. **Code Quality** - Eliminate anti-patterns, enforce hook size limits
2. **Feature Completion** - Ship 6-10 new features across 3 weeks
3. **Testing & Polish** - Maintain 100% test pass rate, improve coverage

---

## 📅 Weekly Plan

### Week 1: Foundation & Financial Features (Dec 2-8) 🔄 IN PROGRESS

#### Fixes & Refactoring

- [x] Refactor 4 oversized hooks (useNavigationFlow, useConnectionFlow, useCaseManagement, useAlertsFlow)
- [x] Extract CaseOperationsService for business logic separation
- [x] PR #87 merged to main
- [x] FinancialItemModal refactor → `useFinancialItemFlow` hook
- [x] Fix Category Manager checkbox reset bug (countsAsCompleted)

#### New Features

- [x] AVS Import UI in Financials tab
- [x] Bulk case list actions (multi-select delete/status change)
- [x] Filter/sort persistence with localStorage and reset button
- [ ] Refresh Case Summary Generator with better format for sharing
- [ ] Improve navigation UX - better return tracking and anchor linking

#### Polish & Documentation

- [ ] Update feature catalogue with new features
- [ ] Add tests for useAVSImportFlow hook
- [ ] Commit and merge to main

---

### Week 2: Reporting & Analytics (Dec 9-15)

#### Fixes & Refactoring

- [ ] Add unit tests for Week 1 extracted hooks
- [ ] Fix any bugs discovered from Week 1 features
- [ ] Performance audit on dashboard load time

#### New Features

- [ ] Case timeline view (activity log visualization)
- [ ] Export case data to CSV/PDF
- [ ] Dashboard widget: Cases by age distribution
- [ ] Financial summary report per case

#### Polish & Documentation

- [ ] Accessibility audit (jest-axe) for new components
- [ ] Update copilot-instructions with 200-line hook target
- [ ] Performance baseline documentation (1k cases)

---

### Week 3: UX Improvements & Automation (Dec 16-22)

#### Fixes & Refactoring

- [ ] Address any accessibility issues from Week 2 audit
- [ ] Optimize large case list rendering
- [ ] Clean up deprecated code paths

#### New Features

- [ ] Keyboard shortcuts for common actions
- [ ] Case templates for quick creation
- [ ] Alert auto-assignment based on MCN matching
- [ ] Notes search/filter functionality

#### Polish & Documentation

- [ ] Create December changelog
- [ ] Update feature catalogue ratings
- [ ] Plan January roadmap
- [ ] Final test suite run, target 290+ tests

---

### Week 4: Holiday Break (Dec 23-31) 🎄

**Off** - No planned development. Emergency fixes only if needed.

---

## 📊 Success Metrics

| Metric                        | Start | Week 1 | Week 2 | Week 3 | Target |
| ----------------------------- | ----- | ------ | ------ | ------ | ------ |
| Hooks over 200 lines          | 4     | 0 ✅   | 0      | 0      | 0      |
| Components with anti-patterns | 1     | 0 ✅   | 0      | 0      | 0      |
| Test count                    | 253   | 282 ✅ | 290    | 300    | 300+   |
| New features shipped          | -     | 6 ✅   | 4      | 4      | 14     |
| Average feature rating        | 76.5  | 77.1   | 78     | 80     | 80+    |

---

## 🔴 Priority by Week

### Week 1 - P0

1. ~~Hook refactoring~~ ✅
2. ~~FinancialItemModal anti-pattern fix~~ ✅
3. ~~Category Manager checkbox bug~~ ✅
4. ~~Bulk case list actions~~ ✅
5. ~~Filter/sort persistence~~ ✅

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
- **Each week includes:** fixes, features, polish, and documentation

### Quality Gates

Every feature must:

1. Pass all existing tests
2. Include tests for new functionality
3. Follow established patterns (hooks delegate to services)
4. Be documented in feature catalogue

---

**Prepared by:** GitHub Copilot  
**Last updated:** December 3, 2025
