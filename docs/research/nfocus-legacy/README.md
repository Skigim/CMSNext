# N-FOCUS Research Consolidation

## Purpose

This document consolidates the March 2026 N-FOCUS reverse-engineering sweep into a single repo-facing reference.

The goal is not to recreate N-FOCUS architecture. The useful output from the research is:

1. A feature checklist for where CMSNext data schemas may need to expand.
2. A short list of UX and navigation patterns from N-FOCUS that may be worth adopting.
3. A concrete follow-up list for finishing cleanup from CMSNext's local v2.1 normalization refactor.

## Research Scope

The public documentation crawl was limited to static help content hosted at `https://public-dhhs.ne.gov/nfocus/`.

Observed access pattern:

- The public root and some expected directory indexes were not directly browseable.
- The live help surface was available primarily through `Windows/<Module>/default.htm` plus MadCap `Data/Index*.js` payloads.
- Directly reachable legacy pages such as `SVES Overview` and `Search By SSN` were also inspected.

This means the research should be treated as a documentation-driven checklist, not a complete system inventory.

## N-FOCUS Areas Observed

The public help content clustered around these module families:

1. Case Maintenance
2. Eligibility
3. Expert Navigation
4. Financial Tasks
5. Interfaces
6. Navigate
7. Nonfinancial Tasks
8. Program Case
9. Summaries

Across those modules, the recurring concepts were:

- case actions and lifecycle changes
- participant and household roles
- nonfinancial facts and verification
- financial detail with history and verification
- current/history/update/reopen views
- review and recertification flows
- list/detail and search-driven selection patterns

## What Matters For CMSNext

The important question is not whether CMSNext should mirror N-FOCUS modules one-for-one. The important question is which domain concepts suggest missing or under-modeled local data structures.

CMSNext already persists the normalized v2.1 workspace shape with top-level collections:

- `people`
- `cases`
- `financials`
- `notes`
- `alerts`

That persisted shape is already documented in:

- [README.md](/workspaces/CMSNext/README.md#L79)
- [FileStorageService.ts](/workspaces/CMSNext/utils/services/FileStorageService.ts#L74)
- [storageV21Migration.ts](/workspaces/CMSNext/utils/storageV21Migration.ts#L15)

So the next step is not more denormalization. The next step is to decide which additional top-level collections or normalized subrecords CMSNext should add.

## Data Shape Checklist

### 1. Case Participants And Role History

N-FOCUS repeatedly models case participation, non-participant roles, financially responsible persons, household status, and role-specific reasons.

CMSNext currently has:

- `CasePersonRef`
- `CasePersonRole`
- primary person / linked people hydration

That is a good foundation, but it is thin.

Potential schema expansion:

```ts
interface CaseParticipant {
  id: string;
  caseId: string;
  personId: string;
  role: string;
  participationStatus?: string;
  participationReason?: string;
  effectiveDate?: string;
  endDate?: string | null;
  verificationId?: string | null;
}
```

Why it matters:

- separates person identity from case-specific participation
- supports status and reason changes over time
- avoids stuffing workflow state into `Person` or `CaseRecord`

### 2. Generic Verification Records

N-FOCUS uses verification throughout the product, not only in financial entry flows.

CMSNext already supports financial verification well through amount history and verification metadata, but that pattern is not yet generalized beyond financials.

Potential schema expansion:

```ts
interface VerificationRecord {
  id: string;
  caseId: string;
  entityType:
    | "person"
    | "case"
    | "financial"
    | "nonfinancial-fact"
    | "participant";
  entityId: string;
  fieldName?: string;
  status: string;
  source?: string;
  verifiedAt?: string;
  expiresAt?: string | null;
  notes?: string;
}
```

Why it matters:

- reuses one verification model across financial and nonfinancial workflows
- keeps verification state normalized instead of duplicating status/source fields everywhere

### 3. Nonfinancial Facts

This was the biggest domain gap surfaced by the N-FOCUS help docs.

Examples observed in public documentation:

- family relationships
- Medicare coverage
- medical impairment
- guardianship / representative status
- household status
- work registration or employability flags
- living arrangement context

Potential schema expansion:

```ts
interface NonfinancialFact {
  id: string;
  caseId: string;
  personId?: string | null;
  category: string;
  subtype?: string;
  status?: string;
  value?: string;
  effectiveDate?: string;
  endDate?: string | null;
  metadata?: Record<string, string | boolean | number | null>;
}
```

Why it matters:

- provides one normalized place to start recording nonfinancial program facts
- allows the team to add categories incrementally without exploding `CaseRecord`

### 4. Case Actions And Domain Lifecycle Events

N-FOCUS distinguishes domain actions from generic activity.

CMSNext already has an activity log, but that is not the same thing as domain case actions like:

- add/reopen/close case action
- household status update
- review/recertification change
- priority or workflow-driven action history

Potential schema expansion:

```ts
interface CaseAction {
  id: string;
  caseId: string;
  actionType: string;
  effectiveDate?: string;
  reason?: string;
  outcome?: string;
  createdAt: string;
  createdBy?: string;
  notes?: string;
}
```

Why it matters:

- keeps domain workflow history separate from system/activity logging
- provides a future home for close/reopen/review history without overloading `status`

### 5. Coverage Or Program Period Records

Many N-FOCUS facts are period-bound rather than permanent.

Even if CMSNext never becomes a full eligibility engine, it may still benefit from a reusable pattern for temporal records.

Potential schema expansion:

```ts
interface CoverageRecord {
  id: string;
  caseId: string;
  personId?: string | null;
  coverageType: string;
  identifier?: string;
  beginDate?: string;
  endDate?: string | null;
  status?: string;
  verificationId?: string | null;
}
```

Why it matters:

- useful for Medicare or insurance-style records
- provides a generic pattern for date-bound entitlements or statuses

### 6. Review Or Recertification Milestones

The public help topics repeatedly surfaced review dates, recertification, and current/history flows.

Potential schema expansion:

```ts
interface ReviewMilestone {
  id: string;
  caseId: string;
  kind: string;
  dueDate: string;
  completedAt?: string | null;
  status: string;
  notes?: string;
}
```

Why it matters:

- provides structure for review-driven workflows
- aligns with dashboard or alert generation without requiring nested case records

## Suggested Normalized Direction

If CMSNext expands its local-first schema based on this research, the likely direction is more top-level collections rather than deeper nested case blobs.

A likely future workspace envelope could look like:

```ts
interface NormalizedFileDataVNext {
  version: "2.x";
  people: StoredPerson[];
  cases: PersistedCase[];
  financials: StoredFinancialItem[];
  notes: StoredNote[];
  alerts: AlertRecord[];
  caseParticipants?: CaseParticipant[];
  verifications?: VerificationRecord[];
  nonfinancialFacts?: NonfinancialFact[];
  caseActions?: CaseAction[];
  coverageRecords?: CoverageRecord[];
  reviewMilestones?: ReviewMilestone[];
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
  activityLog: CaseActivityEntry[];
  templates?: Template[];
}
```

This fits the v2.1 normalization direction already in the repo and avoids backsliding into nested per-case storage.

## UX And Navigation Patterns Worth Considering

This section is intentionally selective. It captures patterns from the legacy help docs that may improve CMSNext UX without implying any architectural match.

### 1. Current / History / Update Split

This was one of the most common legacy patterns.

Potential CMSNext adaptation:

- current view for the active record state
- history view for time-based changes
- update action that writes a new effective record rather than mutating in place

Good fit for:

- financial amount history
- future verification history
- nonfinancial fact timelines
- coverage periods

### 2. Search-First Selection Dialogs

Legacy N-FOCUS uses search and selection windows heavily.

Potential CMSNext adaptation:

- person selection modal
- linked person / household assignment modal
- search-first selection flow when attaching existing records to a case

This aligns with current app patterns better than route-heavy admin pages.

### 3. List / Detail / Timeline Combinations

The legacy help system repeatedly pairs list pages with detail and history views.

Potential CMSNext adaptation:

- record list on the left or in a table
- detail panel for current value
- timeline panel for history and verification

This fits the existing local data model and keeps new feature work incremental.

### 4. Confirmation For Domain-Significant Actions

N-FOCUS uses confirmation windows around domain transitions.

Potential CMSNext adaptation:

- confirm close / reopen / archive-like actions
- confirm role changes or review completions
- record reason at confirmation time

### 5. Review Queue Flow

The review / recertification topics suggest a queue-style UX.

Potential CMSNext adaptation:

- dashboard widget for upcoming reviews
- alert-driven due items list
- case-level review milestone summary

### 6. Command / Go-To Navigation For Cross-Feature Work

The legacy menu-driven navigation suggests a command style flow when a user needs to jump quickly between related records.

Potential CMSNext adaptation:

- enrich global search and command palette behavior
- jump from case to person-linked records, verification items, and review milestones

## What Not To Adopt Literally

These parts of the legacy research are useful as domain clues but should not be copied directly into CMSNext planning:

- inferred REST endpoint maps
- federal/state interface assumptions
- one-for-one route structures based on the legacy help tree
- program-specific policy engines and agency jargon without a clear CMSNext use case

The data checklist above is the durable output. The rest should be treated as context only.

## Follow-Up Needed From The Local Refactor

The storage refactor to top-level `people`, `financials`, `notes`, and `alerts` is real and present in the canonical v2.1 persisted model. The remaining cleanup work is mostly type and tooling debt.

### High Priority Cleanup

1. Remove or replace `CaseData` in [types/case.ts](/workspaces/CMSNext/types/case.ts#L230).

Why:

- it still models the old nested `caseRecords` structure
- it still carries UI counters and app-state fields from the pre-normalized design
- it does not reflect the persisted v2.1 workspace shape

2. Remove stale `financials` and `notes` from `CaseRecord` in [types/case.ts](/workspaces/CMSNext/types/case.ts#L186).

Why:

- those fields are not part of canonical persisted v2.1 cases
- `StoredCase` already strips them out
- `FileStorageService` explicitly treats them as legacy/non-canonical shape during validation

3. Revisit `CaseDisplay` and `StoredCase` naming in [types/case.ts](/workspaces/CMSNext/types/case.ts#L333).

Why:

- the runtime hydrated case model is valid
- but the current type chain still inherits stale nested-case semantics from `CaseRecord`

Suggested direction:

- define a dedicated runtime case record type with only canonical fields
- stop deriving runtime types from the old nested `CaseRecord`

### Tooling Cleanup

4. Rewrite seed tooling to emit normalized v2.1 data instead of `CaseData`.

Affected files:

- [scripts/seedCli.ts](/workspaces/CMSNext/scripts/seedCli.ts#L14)
- [scripts/generateSeedData.ts](/workspaces/CMSNext/scripts/generateSeedData.ts#L14)

Why:

- the current seed scripts still generate nested `caseRecords` with embedded `financials` and `notes`
- this keeps old schema concepts alive in developer tooling

5. Revisit test helpers that still build from the older nested case abstractions.

Primary area:

- [src/test/testUtils.ts](/workspaces/CMSNext/src/test/testUtils.ts#L139)

Why:

- test helpers should reflect the canonical persisted shape and the intentional runtime hydration boundary
- otherwise they continue to hide type drift

### Documentation Cleanup

6. Align type comments and examples with v2.1 terminology.

Why:

- parts of the repo still talk about old nested structures indirectly
- the storage refactor will remain harder to reason about until examples and helper types stop implying nested per-case `financials` and `notes`

## Recommended Next Work Order

1. Clean `types/case.ts` so persisted and runtime case shapes are explicit and no longer inherit stale nested fields.
2. Update seed generation to produce canonical normalized v2.1 data.
3. Update test helpers and fixtures to reflect the canonical persisted shape plus hydration boundary.
4. Only after that, decide which new top-level schema collections to add from the checklist above.

## Summary

The N-FOCUS research is most useful as a schema-expansion checklist.

The immediate lessons for CMSNext are:

- keep the normalized top-level collection approach
- expand through new collections, not by re-nesting case data
- adopt a few UX patterns such as current/history/update, search-first selection, and review queues
- finish cleaning up the lingering pre-v2.1 type and tooling surface before introducing new schema areas
