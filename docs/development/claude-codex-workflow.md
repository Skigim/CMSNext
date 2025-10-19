# Claude–Codex Workflow for CMSNext

## 🎯 Purpose
This document defines the workflow for using Claude Sonnet 4.5 as the strategic planner/reviewer and GPT-5 Codex as the executor/debugger in the CMSNext CRM project. The goal is to combine Claude’s architectural reasoning with Codex’s implementation speed.

## 🔄 Workflow Overview

### 1. Feature Planning (Claude)
**Input:** High-level feature request (for example, “Add pipeline stages to CRM leads”).

Claude produces a feature plan document in `/docs/features/` that covers:
- Data schema changes
- UI flow diagrams or descriptions
- API endpoints
- Test cases and acceptance criteria

### 2. Implementation (Codex)
**Input:** Claude’s feature plan document.

Codex generates:
- Backend code (Prisma schema, API routes)
- Frontend updates (React components, hooks, contexts)
- Tests (Vitest unit and integration suites)

**Output:** A PR-ready branch with working code.

### 3. Review & Documentation (Claude)
**Input:** Codex’s PR diff.

Claude reviews for:
- Code clarity and maintainability
- Alignment with CMSNext conventions
- Error handling and edge cases

Claude also updates documentation:
- `README.md` usage notes
- `docs/architecture.md`
- Inline JSDoc/TypeDoc comments

### 4. Refinement Loop (Codex)
Codex applies Claude’s review suggestions, runs additional tests, and fixes regressions. Merge once Claude signs off.

### 5. Automation Hooks
- Claude generates `feature-plan.md` files stored under `/docs/features/`.
- Codex watches `/docs/features/` and generates code in `/src/` and `/tests/`.
- Claude automatically reviews PRs tagged `needs-review`.

## 📂 Repo Conventions
- Docs: `/docs/features/<feature>.md`
- Source: `/src/`
- Tests: `/tests/`
- Branches: `feature/<name>` → PR → `main`

## ✅ Review Checklist
Before merging, confirm:
- [ ] Feature plan document exists and is linked in the PR
- [ ] Tests cover happy path plus edge cases
- [ ] Documentation updates (README, architecture.md) are included
- [ ] Linting and type checks pass
- [ ] Claude review completed
