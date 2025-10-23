# Architecture Refactor - Quick Start Guide

**Last Updated:** October 23, 2025  
**For:** Single Codex agent executing refactor  
**Duration:** 4 weeks (Nov 1-30, 2025)

---

## 📖 Overview

This refactor transforms CMSNext from monolithic React architecture to clean domain-driven design:

**From:** 2 data stores → **To:** 1 unified ApplicationState  
**From:** Manual sync calls → **To:** Event-driven architecture  
**From:** Business logic in hooks → **To:** Domain use cases  
**From:** Tangled dependencies → **To:** 5 isolated domains

---

## 🚀 Getting Started

### Prerequisites Checklist

Before starting Phase 1, verify:

- [ ] All Phase 4 telemetry baselines captured (Oct 19, 2025)
- [ ] 211/211 tests passing
- [ ] Performance benchmarks in `reports/performance/`
- [ ] Clean git status on `main` branch
- [ ] Node modules up to date (`npm install`)

### Create Feature Branch

```bash
git checkout -b feat/architecture-refactor
git push -u origin feat/architecture-refactor
```

---

## 📅 4-Week Timeline

### Week 1 (Nov 1-7): Phase 1 - Foundation
**Goal:** Repository pattern + ApplicationState singleton

**Key Deliverables:**
- Domain folder structure created
- Repository interfaces for 5 domains
- StorageRepository implementation
- ApplicationState singleton with React integration
- Feature flags system
- Cases domain proof of concept

**Success Criteria:** 50+ new tests, all 211+ tests passing

---

### Week 2 (Nov 8-14): Phase 2 - State Management
**Goal:** Event bus + eliminate manual syncs

**Key Deliverables:**
- EventBus for cross-domain communication
- Domain event types defined
- Remove all `safeNotifyFileStorageChange()` calls
- AppContent reads from ApplicationState
- Compatibility layer for gradual migration

**Success Criteria:** Zero manual syncs, single source of truth validated

---

### Week 3 (Nov 15-21): Phase 3 - Use Case Extraction
**Goal:** Move business logic to domain layer

**Key Deliverables:**
- Complete all 5 domain entities
- 15+ use case classes
- Thin hook wrappers (< 50 lines each)
- Activity log captures all events
- Migrate logic from old hooks

**Success Criteria:** 100+ new domain tests, 80%+ domain coverage

---

### Week 4 (Nov 22-30): Phase 4 - Worker Prep & Cleanup
**Goal:** Worker interfaces + finalization

**Key Deliverables:**
- Worker message contracts
- WorkerBridge abstraction
- Performance validation (no >10% regressions)
- Enable all feature flags
- Remove legacy code
- Complete documentation (ADRs, guides)

**Success Criteria:** 250+ tests passing, production-ready

---

## 📚 Key Documents

### Strategic Planning
- **`architecture-refactor-plan.md`** - High-level strategy, ADRs, success metrics
- **`REFACTOR_AGENT_PROMPTS.md`** - Detailed implementation guide (this is your main reference)

### Implementation Reference
- **Phase 1:** Lines 1-500 (Foundation)
- **Phase 2:** Lines 501-1000 (State Management)
- **Phase 3:** Lines 1001-1500 (Use Cases)
- **Phase 4:** Lines 1501-1800 (Worker Prep)

### Supporting Docs
- `PROJECT_STRUCTURE.md` - Folder organization
- `testing-infrastructure.md` - Test strategy
- `performance-metrics.md` - Benchmarking approach

---

## 🛠️ Daily Workflow

### Morning Routine
1. Check test status: `npm run test:run`
2. Review yesterday's commits: `git log --oneline -5`
3. Read next section in `REFACTOR_AGENT_PROMPTS.md`
4. Identify tasks for today

### Implementation Loop
1. Write code following prompts
2. Write tests (aim for >80% coverage)
3. Run tests: `npm run test:run`
4. Commit with descriptive message
5. Update progress in `WORK_STATUS.md`

### Evening Wrap-Up
1. Run full test suite
2. Check for TypeScript errors
3. Push commits to branch
4. Document any blockers or decisions

---

## 🎯 Key Architectural Decisions

### 1. Singleton ApplicationState (Not Zustand)
**Why:** Zero dependencies, framework-agnostic, worker-ready  
**Code:** `application/ApplicationState.ts`

### 2. StorageRepository Implements All Interfaces
**Why:** Single point of file system interaction  
**Code:** `infrastructure/storage/StorageRepository.ts`

### 3. Folder Structure (No `src/` prefix)
```
domain/          # Business logic
  cases/
  financials/
  notes/
  alerts/
  activity/

infrastructure/  # External concerns
  storage/
  worker/

application/     # Orchestration
  hooks/
  services/
  migration/
```

### 4. Event-Driven Cross-Domain Communication
**Why:** Decoupling, testability, observability  
**Code:** `application/EventBus.ts`

### 5. Gradual Rollout with Feature Flags
**Why:** Risk mitigation, continuous delivery  
**Code:** `utils/featureFlags.ts`

---

## 🧪 Testing Strategy

### Test Distribution Target
- **Domain tests:** 150+ (entities, use cases, repositories)
- **Integration tests:** 50+ (cross-domain flows)
- **React tests:** 50+ (hooks, components)
- **Total:** 250+ tests

### Coverage Goals
- Domain logic: 85%+
- Use cases: 90%+
- Entities: 95%+
- Overall: 75%+

### Test Commands
```bash
npm run test:run          # Run all tests once
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

---

## 🚨 Red Flags

**STOP WORK immediately if you encounter:**

1. **Test failures** that can't be fixed in 30 minutes
2. **Performance regression** >10% on any baseline
3. **Data corruption** in file storage
4. **Circular dependencies** between domains
5. **TypeScript errors** that break builds

**Recovery Protocol:**
1. Commit current work with "RED FLAG" prefix
2. Document the issue in `WORK_STATUS.md`
3. Create GitHub issue with `refactor-blocker` label
4. Revert to last known good commit if needed

---

## 📊 Progress Tracking

### Daily Checklist
- [ ] Tests passing (report count: X/Y)
- [ ] No TypeScript errors
- [ ] Commits pushed to branch
- [ ] WORK_STATUS.md updated
- [ ] Blocked on: (if applicable)

### Weekly Milestones
**Week 1:** ✅ Phase 1 complete, foundation solid  
**Week 2:** ✅ Phase 2 complete, single source of truth  
**Week 3:** ✅ Phase 3 complete, all domains extracted  
**Week 4:** ✅ Phase 4 complete, production-ready

---

## 🎓 Learning Resources

### Clean Architecture
- **Layers:** Presentation → Application → Domain → Infrastructure
- **Dependency Rule:** Inner layers know nothing about outer layers
- **Key Principle:** Business logic never depends on frameworks

### Domain-Driven Design
- **Entities:** Objects with identity (Case, FinancialItem)
- **Value Objects:** Immutable descriptors (Person, Address)
- **Aggregates:** Consistency boundaries
- **Repositories:** Persistence abstraction

### Event-Driven Architecture
- **Domain Events:** Facts about what happened
- **Event Bus:** Decoupled communication channel
- **Subscribers:** React to events independently

---

## ✅ Final Checklist (Week 4, Day 7)

Before merging to `main`:

- [ ] All 250+ tests passing
- [ ] No TypeScript errors in strict mode
- [ ] Performance within 10% of baselines
- [ ] Bundle size < 600 kB raw, < 160 kB gzipped
- [ ] Accessibility tests pass (jest-axe)
- [ ] All feature flags enabled
- [ ] Legacy code archived (not deleted)
- [ ] Documentation complete (ADRs, guides, diagrams)
- [ ] `WORK_STATUS.md` updated with "COMPLETE"
- [ ] Production build verified (`npm run build`)
- [ ] PR created with detailed description

---

## 🚀 Next Steps After Completion

1. **Merge to main** via pull request
2. **Deploy to production** (if applicable)
3. **Monitor telemetry** for first week
4. **Gather team feedback** on new patterns
5. **Plan worker integration** (Phase 5, optional)

---

## 💬 Questions?

**Strategic:** Review `architecture-refactor-plan.md`  
**Implementation:** Review `REFACTOR_AGENT_PROMPTS.md`  
**Technical:** Check `PROJECT_STRUCTURE.md`, ADRs  
**Blocked:** Document in `WORK_STATUS.md`, create issue

---

**Good luck! This is a significant improvement to the codebase. Take it one phase at a time, test thoroughly, and commit frequently.** 🎉
