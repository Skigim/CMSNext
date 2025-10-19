# CMSNext Actionable Roadmap

> Outcome-focused plan derived from the feature catalogue. Updated at the start of each milestone planning cycle or when priorities shift.

**Last Updated:** October 16, 2025  
**Status:** Near-term milestones (30-day window) **COMPLETED** ✅

## Guiding Principles

- Ship improvements that strengthen the local-first promise before adding new surface area.
- Complete shadcn/ui migration in small, testable slices to avoid long-running branches.
- Pair every feature investment with tests, telemetry, or documentation recovery so the platform stays observable.
- Keep performance and accessibility baselines green; no initiative closes without measuring its impact.

---

## ✅ Near-Term Focus (Completed October 8-16, 2025)

### 1. **Shadcn Migration** ✅ COMPLETE (PR #28)
**Delivered:**
- ✅ All 7 target components migrated to shadcn/ui primitives
- ✅ New Spinner component with theme integration
- ✅ Deleted bespoke CSS classes and inline styles
- ✅ +23 new test cases (202/202 passing at merge)
- ✅ Enhanced accessibility with ARIA labels

**Impact:**
- 100% design system consistency
- Simplified maintenance burden
- Theme-compatible styling across all components

### 2. **Telemetry + Health Signals** ✅ COMPLETE (PR #29 Track 1)
**Delivered:**
- ✅ `telemetryCollector.ts` - Opt-in collection stub with PII validation
- ✅ `telemetryInstrumentation.ts` - Helper utilities for performance tracking
- ✅ Extended `useFileDataSync` with storage event instrumentation
- ✅ Extended `useAutosaveStatus` with badge state transition tracking
- ✅ Extended `performanceTracker.ts` with storage health metrics
- ✅ 523-line `telemetry-guide.md` documentation

**Impact:**
- Observable autosave health metrics
- Foundation for usage analytics service
- PII-safe event collection ready for production

### 3. **Accessibility Gate** ✅ COMPLETE (PR #29 Track 2)
**Delivered:**
- ✅ Installed `jest-axe` (v10.0.0) and TypeScript types
- ✅ Configured in `src/test/setup.ts`
- ✅ Added accessibility checks to case workflows (CaseForm, CaseDetails)
- ✅ Added accessibility checks to financial workflows (FinancialItemCard)
- ✅ Added accessibility checks to dashboard and navigation
- ✅ 445-line `accessibility-testing.md` guide
- ✅ Updated `testing-infrastructure.md` with jest-axe patterns

**Impact:**
- Automated WCAG 2.1 AA compliance checking
- Documented remediation workflows
- Foundation for CI accessibility gates

### 4. **Dashboard Widget Framework** ✅ COMPLETE (PR #29 Track 3)
**Delivered:**
- ✅ Widget Registry with lazy loading and error boundaries
- ✅ `useWidgetData` hook with freshness tracking and telemetry
- ✅ CasePriorityWidget - Priority breakdown visualization
- ✅ ActivityTimelineWidget - Recent activity (last 7 days)
- ✅ 533-line `widget-development.md` guide
- ✅ Dashboard integration with 2 production widgets

**Impact:**
- Extensible architecture for rapid widget development
- Real-time insights with freshness indicators
- Performance instrumentation built-in

---

## 🔄 Mid-Term Focus (Next 30–90 Days)

### 1. **Dashboard Insights Expansion** 🎯 Next Up
**Outcome:** Rich, actionable dashboard with 5-7 widgets providing comprehensive case management insights.

**Key Tasks:**
- Build 3-5 additional widgets:
  - **Alerts Widget** - High-priority cases requiring immediate attention
  - **Financial Trends Widget** - Lightweight visualization of resource/income/expense trends
  - **Storage Health Widget** - Autosave status, backup info, file system health
  - **Recent Imports Widget** - Activity log filtered to import events
  - **Notes Activity Widget** - Recent client contacts and follow-ups
- Performance profiling for dashboards with 5+ widgets
- Accessibility testing for all new widgets (jest-axe + manual screen reader testing)
- Bundle size analysis to ensure lazy loading effectiveness

**Dependencies:**
- ✅ Widget framework complete and proven
- ✅ Telemetry infrastructure ready for performance tracking
- ⏳ Phase 4 manual telemetry captures (dashboard load profiling)

**Risks:**
- Bundle growth → Mitigate with lazy imports and tree-shaking analysis
- Render performance → Monitor via React Profiler, optimize with memoization
- Data staleness → Tune refresh intervals based on usage patterns

### 2. **Financial Operations Enhancements** 📋 Design Phase
**Outcome:** Per-item changelog and enhanced verification workflows for compliance and audit trails.

**Key Tasks:**
- Design changelog schema (timestamp, user, field, old value, new value)
- Surface history in UI (integrate with activity log or dedicated financial history view)
- Expand validation rules:
  - Negative-balance alerts for resources
  - Income/expense ratio thresholds
  - Verification deadline tracking
- Add bulk verification actions (mark multiple items verified)
- Contextual guidance for verification workflows

**Dependencies:**
- ✅ Telemetry ready to monitor autosave timing impact
- ⏳ Activity log enhancements for financial event tracking
- ⏳ Design review for changelog UI/UX

**Risks:**
- Storage churn from frequent changelog writes → Monitor autosave latency, consider batching
- Schema migration for existing cases → Plan backward-compatible changelog structure
- Compliance requirements → Coordinate with stakeholders to validate schema meets audit needs

### 3. **Data Portability Improvements** 📋 Ready to Start
**Outcome:** User-friendly import/export with clear error remediation and optional anonymization.

**Key Tasks:**
- Extend validation messaging with actionable remediation steps
  - Example: "Missing required field 'mcn' on row 5. Add MCN value and re-import."
- Add anonymization CLI flag for exports (`--anonymize` strips PII)
- Update seed data scripts to generate anonymized test datasets
- Document import/export workflows in user-facing guide
- Add progress indicators for large imports (>100 cases)

**Dependencies:**
- ✅ DataManager and validation utilities proven stable
- ⏳ UX review for error messaging copy
- ⏳ Documentation squad for user-facing guides

**Risks:**
- User education → Require clear documentation + in-app tooltips
- Anonymization thoroughness → Audit for hidden PII (embedded in notes, descriptions)
- Import performance → Test with 500+ case datasets, optimize if needed

---

## 🚀 Long-Term Bets (90+ Days)

### **Usage Metrics Service** 📊 Foundation Ready
Graduated telemetry groundwork into lightweight, opt-in analytics layer.

**Prerequisites:**
- ✅ Telemetry collector with PII validation complete
- ✅ Performance tracker extended with storage health
- ⏳ Production usage data collection (opt-in)

**Next Steps:**
- Build aggregation service for telemetry events
- Create usage dashboard showing feature adoption, autosave health, navigation patterns
- Integrate insights into roadmap prioritization

### **Collaborative Note Threads** 💬 Future Enhancement
Introduce conversation threads and mentions once storage scaling profile is validated.

**Prerequisites:**
- ⏳ Storage performance benchmarks with 1,000+ cases
- ⏳ Notes schema extension design (threading, mentions)
- ⏳ Conflict resolution strategy for concurrent edits

**Next Steps:**
- Design threaded conversation UI/UX
- Implement mention parser and notification system
- Validate storage impact with large note datasets

### **Release Automation** 🔧 Tooling Enhancement
Ship signed bundles with reproducible build metadata tied into deployment guide.

**Prerequisites:**
- ✅ Build process stable (Vite + Tailwind v4)
- ⏳ Signing key management strategy
- ⏳ CI/CD pipeline design

**Next Steps:**
- Automate version bumping and changelog generation
- Generate signed artifacts with checksums
- Document release process in DeploymentGuide.md

### **Progressive Compatibility Mode** 🌐 Browser Support
Investigate read-only experience for browsers without File System Access API.

**Prerequisites:**
- ⏳ Fallback strategy design (drag-drop JSON, localStorage read-only preview)
- ⏳ Browser compatibility matrix update
- ⏳ User guidance for unsupported browsers

**Next Steps:**
- Implement drag-drop JSON loader for Firefox/Safari
- Build read-only preview mode without file writes
- Add browser detection and compatibility messaging

---

## 📋 Phase 4 Technical Debt (High Priority)

### **Manual Telemetry Captures** ⏳ Pending
Required before architecture refactor kickoff.

**Outstanding Work:**
- [ ] Real navigation trace (dashboard → case list → case detail → back)
- [ ] Live React Profiler session capturing AppContent commits
- [ ] Autosave latency benchmark in real browser session (vs synthetic)
- [ ] Dashboard load profiling with 3+ widgets active

**Owner:** Platform observability squad  
**Timeline:** Complete within 2 weeks (by October 30, 2025)

### **Accessibility Expansion** ⏳ In Progress
Build on jest-axe foundation with comprehensive coverage.

**Outstanding Work:**
- [ ] Keyboard navigation end-to-end tests (tab order, focus traps)
- [ ] WCAG 2.1 AA color contrast verification across all 5 themes
- [ ] Screen reader testing (NVDA on Windows, VoiceOver on macOS)
- [ ] Integrate axe-core into CI pipeline (fail builds on violations)

**Owner:** Accessibility working group  
**Timeline:** Incremental progress over next 30 days

### **Documentation Updates** ⏳ Pending
Keep external-facing docs aligned with recent changes.

**Outstanding Work:**
- [ ] Update feature catalogue ratings (Local Storage: 80→85, Dashboard: 70→78)
- [ ] Add widget examples and screenshots to README.md
- [ ] Create video walkthrough for permission recovery flows
- [ ] Publish contributing guide for widget development

**Owner:** Documentation squad  
**Timeline:** Complete within 1 week (by October 23, 2025)

---

## 🎯 Architecture Refactor Readiness

### **Current Status:** 🟡 85% Ready

**Completed Prerequisites:**
- ✅ Shadcn migration 100% complete
- ✅ Telemetry infrastructure in place
- ✅ Accessibility testing established
- ✅ Widget framework proves composability patterns
- ✅ All 211 tests passing with zero regressions

**Remaining Before Refactor:**
- ⏳ Phase 4 manual telemetry captures (performance baselines)
- ⏳ Feature catalogue rating updates
- ⏳ Accessibility audit across all 5 themes
- ⏳ Architecture refactor plan finalized and reviewed

**Recommendation:**
- **Begin refactor planning NOW** (draft architecture, identify boundaries)
- **Execute refactor AFTER** Phase 4 telemetry complete (by November 1, 2025)
- **Target:** Clean architecture with domain-driven design, worker-ready boundaries

---

## 📊 Operating Cadence

### **Sprint Planning (Every 2 Weeks)**
- Review roadmap items against `feature-catalogue.md`
- Prune orphaned tasks and update priorities
- Assign ownership and timelines
- Communicate dependencies and blockers

### **Feature PR Checklist**
Every feature PR must include:
- ✅ Tests (unit + integration where applicable)
- ✅ Telemetry/performance tracking (if user-facing)
- ✅ Documentation updates (inline docs + guides)
- ✅ Accessibility check (jest-axe where applicable)
- ✅ Zero regressions (all existing tests passing)

### **Monthly Retrospective**
- Capture wins, gaps, and follow-on work in feature catalogue
- Update roadmap priorities based on usage data and feedback
- Review performance metrics and accessibility compliance
- Identify technical debt and prioritize remediation

### **Roadmap Sync Process**
When priorities shift:
- Update **both** actionable roadmap and feature catalogue in same change set
- Document reasoning and stakeholder decisions
- Communicate changes to all contributors
- Preserve historical context for future reference

---

## 🎉 Recent Achievements (October 8-16, 2025)

**What Shipped:**
- ✅ 7 components fully migrated to shadcn/ui (100% design system consistency)
- ✅ Accessibility testing infrastructure (jest-axe + 445-line guide)
- ✅ Telemetry collection framework (PII-safe, opt-in, with 523-line guide)
- ✅ Dashboard widget registry (2 production widgets, extensible architecture)
- ✅ 3 comprehensive documentation guides (1,501 total lines)
- ✅ +46 new test cases (211/211 passing, zero regressions)

**Impact Metrics:**
- 🎨 **Design Consistency:** 100% shadcn migration → unified component library
- ♿ **Accessibility:** jest-axe integrated → automated WCAG 2.1 AA checks
- 📊 **Observability:** Telemetry ready → production insights within reach
- 🚀 **Extensibility:** Widget framework → rapid dashboard expansion enabled

**Team Velocity:**
- 2 major PRs merged in 8 days
- 4,568 lines added across 27 files (PR #29)
- 758 lines added, 277 deleted (PR #28)
- Zero downtime, all tests green

---

## 🔮 Vision Alignment

This roadmap supports CMSNext's **local-first, privacy-first** vision:

1. **No Compromise on Privacy** - Telemetry is opt-in, PII-safe, and locally stored
2. **Accessibility as Default** - Automated testing ensures WCAG 2.1 AA compliance
3. **Performance Obsession** - Widget framework optimized for bundle size and runtime speed
4. **Developer Experience** - Comprehensive guides enable rapid, confident contributions
5. **Incremental Delivery** - Small, tested slices ship continuously without long-lived branches

**Next Milestone:** Mid-term focus (Dashboard expansion + Financial enhancements) → Target completion by December 15, 2025

