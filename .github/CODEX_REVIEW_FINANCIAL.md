<!-- Codex Review Trigger -->

# Review Request: Financial Domain Migration Plan

@copilot Please review the following implementation plan for migrating the Financial domain to Phase 3 architecture:

## Documents to Review

1. **Implementation Prompt**: `CODEX_PROMPT_FINANCIAL_DOMAIN.md`
2. **Critical Discoveries**: `FINANCIAL_MIGRATION_DISCOVERIES.md`
3. **Reference Implementation**: Cases domain (`domain/cases/`, `application/services/Case*.ts`)

## Specific Review Points

### 1. Architecture Alignment

- Does the Financial migration plan align with the proven Cases domain pattern?
- Are the 4 phases (Domain → Service → Hook → Testing) clearly defined?
- Is the dependency injection pattern (Factory) correctly described?

### 2. Critical Discoveries Accuracy

- Are the existing infrastructure discoveries accurate?
  - Domain entity already exists? ✅
  - Repository interface already exists? ✅
  - ApplicationState methods partially exist? ⚠️
- Are the missing pieces clearly identified?
  - Legacy fields in entity? ⚠️
  - State management flags? ⚠️
  - Use cases? ❌ (don't exist)

### 3. Implementation Clarity

- Is it clear that we're EXTENDING existing code, not creating from scratch?
- Are the branching instructions clear and enforceable?
- Is the pre-implementation checklist complete?
- Are the phase-by-phase tasks actionable?

### 4. Risk Mitigation

- Are the common pitfalls from Cases migration documented?
- Is the event naming conflict addressed?
- Are type conflicts between legacy and domain types handled?
- Is the testing strategy comprehensive (60+ new tests)?

### 5. Success Criteria

- Is 100% test pass rate enforcement clear?
- Is the LOC reduction target realistic (~40% hook simplification)?
- Is the feature rating increase justified (73 → 85+)?
- Are the incremental commit guidelines clear?

## Questions for Review

1. Should we standardize on `FinancialItemCreated` or `FinancialItemAdded` for event naming?
2. Should legacy fields be added to `FinancialItemSnapshot` directly or stored in `metadata`?
3. Can `ApplicationState` extensions happen in Phase 2 or must they wait for Phase 3?
4. Is the 4-day timeline realistic given existing infrastructure?

## Expected Deliverables

After review, confirm:

- [ ] Implementation plan is complete and accurate
- [ ] No missing steps or dependencies
- [ ] Branching strategy is clear
- [ ] Test coverage targets are achievable
- [ ] Ready to begin execution on feature branch

---

**Note**: This migration builds on the successful Cases domain refactor (rating 79→88, 352/352 tests passing). We expect similar quality improvements for Financial domain.
