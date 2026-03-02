# CMSNext Roadmap - March 2026

**Report Date:** March 2, 2026  
**Branch:** main (stable)  
**Tests:** 1141/1141 passing ✅  
**Build:** Production-ready ✅  
**Average Feature Rating:** 85.5/100

---

## 🎯 March Objectives

1. **UX and Personalization** - Keyboard shortcut configuration, dashboard widgets.
2. **Codebase Evaluation** - Reviewing and planning the next phase of architectural improvements.
3. **TBD** - Future features to be drafted post-evaluation.

---

## 📅 Weekly Plan

### Week 1: Core UX and Personalization (March 2-8)

#### Prep Work

- [x] Fix any remaining bugs inherited from February.
- [ ] Run full audit cycle (performance and accessibility).

#### Features

- [ ] Keyboard Shortcut Customization (Settings panel for rebinding).
- [ ] Dashboard widget personalization (show/hide, reorder).
- [ ] Virtual scrolling for 1k+ datasets.

#### Refactoring & Polish

- [ ] Add unit tests for Week 1 features.
- [ ] Ensure focus management in new modals.

---

### Weeks 2-4: TBD Phase

_To be determined while we think through the codebase and what we can improve._

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
