# CMSNext Roadmap - February 2026

<!-- Retrigger review -->

**Report Date:** February 18, 2026  
**Branch:** main  
**Focus:** Audit Remediation + Archive Completion + SonarCloud Remediation  
**Status:** Week 3 In Progress — Wave 1 Complete ✅

---

## 🤖 Workflow Model

| Role                | Agent           | Responsibilities                                                                |
| ------------------- | --------------- | ------------------------------------------------------------------------------- |
| **Project Manager** | Claude Opus 4.6 | Architectural planning, global state management, roadmap maintenance, PR review |
| **Lead Developer**  | GPT 5.3 Codex   | Implementation, code changes, test writing, rule-by-rule SonarCloud remediation |

**Handoff protocol:** This roadmap is the single source of truth for GPT. Each Wave/task below includes sufficient context about global dependencies, provider nesting, and file ownership so that GPT can execute without re-discovering the architecture. When a task touches a Context provider or shared utility, the _Architectural Context_ section below documents every cross-cutting dependency.

**Commit discipline:** GPT commits in logical batches (one rule family per commit). Claude reviews diff impact on the provider tree and shared state before merge.

**Verification gate:** After each Wave, run `npm test` (1141+ tests) and `npm run build`. No regressions allowed before proceeding to the next Wave.

---

## 🏗️ Architectural Context for GPT

> This section provides the global dependency map GPT needs to safely modify files across the codebase. Read this before starting any Wave.

### Provider Nesting Order (AppProviders.tsx)

```
<ErrorBoundary>
  <ThemeProvider>                         ← standalone, outermost data provider
    <EncryptionProvider>                  ← standalone, Web Crypto API
      <FileSystemErrorBoundary>
        <FileStorageProvider>             ← creates AutosaveFileService + FileStorageService
          <DataManagerProvider>           ← creates DataManager from FS services
            <CategoryConfigProvider>      ← reads from DataManager + FileStorage
              <TemplateProvider>          ← reads from DataManager + FileStorage
                {children}
```

**Rule:** Any change to a Context provider's value shape or memoization _must_ account for all downstream consumers. The dependency flows downward only — never upward or sideways.

### Context → Consumer Map

| Context                 | Hook(s)                                                                                | Key Consumers (components)                                           |
| ----------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `ThemeContext`          | `useTheme()`                                                                           | All themed components, `Settings.tsx`                                |
| `EncryptionContext`     | `useEncryption()`                                                                      | `useEncryptionFileHooks`, file load/save paths                       |
| `FileStorageContext`    | `useFileStorage()`, `useFileStorageDataChange()`, `useFileStorageLifecycleSelectors()` | `useAutosaveStatus`, `useFileDataSync`, `useDataSync`                |
| `DataManagerContext`    | `useDataManager()` (strict), `useDataManagerSafe()` (lenient)                          | Nearly all feature hooks (cases, notes, financials, alerts, archive) |
| `CategoryConfigContext` | `useCategoryConfig()`                                                                  | Case forms, alert pickers, category editor                           |
| `TemplateContext`       | `useTemplates()`                                                                       | Template editor, VR/Summary generation                               |
| `SelectedMonthContext`  | `useSelectedMonth()`                                                                   | Financial views (rendered _inside_ case detail, not in AppProviders) |

### Shared Utilities with Global State / Side Effects

These singletons or stateful modules require caution during refactoring:

| Module                              | Global State                                      | Side Effects                        | SonarCloud Rules Touching It |
| ----------------------------------- | ------------------------------------------------- | ----------------------------------- | ---------------------------- |
| `utils/logger.ts`                   | Global dedup cache (60s window), log level config | `console.*` writes                  | S3358 (nested ternary)       |
| `utils/errorReporting.ts`           | Singleton buffer (100 reports), localStorage      | Global error/rejection listeners    | S2933 (readonly fields ×3)   |
| `utils/alertWriteQueue.ts`          | Per-alert-ID in-memory queue                      | Background async writes             | S2933 (readonly fields ×2)   |
| `utils/IndexedDBHandleStore.ts`     | IndexedDB (`CaseTrackingFileAccess`)              | IndexedDB I/O                       | S6671 (Promise rejection ×3) |
| `utils/fileStorageErrorReporter.ts` | None (stateless classifier)                       | Toast + delegates to errorReporting | S3358 (nested ternary)       |
| `utils/clipboard.ts`                | None                                              | DOM manipulation, clipboard API     | S7762 (childNode.remove)     |
| `utils/dataExportImport.ts`         | None                                              | DOM anchor create/click, download   | S7762 (childNode.remove)     |

### Layer Rules (Do Not Break)

1. **Domain layer (`domain/*`)** — Pure functions only. No I/O, no React, no side effects. ~6,356 lines of business logic.
2. **Service layer (`utils/services/*`, `utils/DataManager.ts`)** — Stateless classes with constructor-injected deps. All mutations go through `DataManager`.
3. **Hooks (`hooks/*`)** — React state + delegating to services/domain. Target ~40-50 lines max.
4. **Components (`components/*`)** — UI only. Call hooks, never services directly.
5. **Contexts (`contexts/*`)** — Global state providers; never call domain directly.

### Service Dependency Chain

```
DataManager (orchestrator, 1441 lines)
  ├─ FileStorageService ← AutosaveFileService
  ├─ CaseService        ← FileStorageService
  ├─ FinancialsService  ← FileStorageService         ← S6582 (optional chaining fix here)
  ├─ NotesService       ← FileStorageService
  ├─ ActivityLogService ← FileStorageService + AutosaveFileService
  ├─ CategoryConfigService ← FileStorageService
  ├─ AlertsService      ← (no deps, in-memory indexing)
  ├─ TemplateService    ← FileStorageService
  ├─ CaseArchiveService ← FileStorageService + AutosaveFileService
  └─ CaseOperationsService ← DataManager             ← S2933 (readonly field fix here)
```

### S6481 Context Value Memoization — Dependency Detail

These 6 context providers create new object references every render. Fixes must use `useMemo` with correct dependency arrays:

| File                                    | Current Value Pattern      | Dependencies for `useMemo`                                                               |
| --------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `contexts/SelectedMonthContext.tsx:142` | Inline object in JSX       | `selectedMonth`, `setSelectedMonth`, `resetToCurrentMonth`, `previousMonth`, `nextMonth` |
| `contexts/FileStorageContext.tsx:452`   | `contextValue` const       | All state values + all callback refs (use `useCallback` for methods first)               |
| `contexts/DataManagerContext.tsx:128`   | Inline object in JSX       | `dataManager` instance ref                                                               |
| `contexts/ThemeContext.tsx:194`         | Inline object in JSX       | `theme`, `tone`, `isDark`, + stable callbacks                                            |
| `components/ui/chart.tsx:53`            | Context value in component | Chart config props                                                                       |
| `components/ui/toggle-group.tsx:36`     | Context value in component | Toggle group value + callbacks                                                           |

> **Caution:** `FileStorageContext` is the most complex — 685 lines with ~15 methods. Memoize methods with `useCallback` first, then wrap the value object in `useMemo`. Verify no stale closures by running the full test suite after changes.

### S6759 Nested React Components — Extraction Strategy

117 files define components inside other components. When extracting:

- Move the inner component to module scope (same file, above the parent).
- Pass any closed-over variables as props.
- If the inner component uses hooks, it _must_ remain a React component (not a plain function).
- Maintain `displayName` for DevTools if the original had one.
- Top-priority files: `CaseEditSections.tsx` (14), `ActivityWidget.tsx` (10), `CaseTable.tsx` (9), `WidgetSkeleton.tsx` (8), `AVSImportModal.tsx` (8).

### UI Library Files (`components/ui/*`) — shadcn/ui Origin

Files like `table.tsx`, `breadcrumb.tsx`, `card.tsx`, `calendar.tsx`, `chart.tsx`, `toggle-group.tsx`, `sidebar.tsx` originate from **shadcn/ui** and have been customized. When fixing SonarCloud issues in these files:

- Preserve the shadcn API surface (`forwardRef`, `displayName`, prop types).
- Minimal changes only — don't restructure.
- The S6819 accessibility role issues in `table.tsx`, `breadcrumb.tsx` are from shadcn defaults — fix with native HTML elements where possible, or add `// NOSONAR` comments if the ARIA usage is intentional and correct.

### Test Infrastructure Quick Reference

| Item               | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| Runner             | Vitest (vitest.config.ts)                                   |
| Environment        | jsdom                                                       |
| Globals            | `true` (no import needed for describe/it/expect)            |
| Setup              | `src/test/setup.ts` (matchers, browser API mocks)           |
| Accessibility      | `jest-axe` with `toHaveNoViolations()`                      |
| Coverage threshold | 70% branches/functions/lines/statements                     |
| Test timeout       | 30,000ms                                                    |
| Path alias         | `@` → project root                                          |
| Mock reset         | `mockReset: true`, `clearMocks: true`, `restoreMocks: true` |
| Test command       | `npm test` (all), `npx vitest run <file>` (single)          |
| Build command      | `npm run build`                                             |

### SonarCloud Issue Data Files

| File                                       | Contents                                                           |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `docs/audit/sonarcloud-open-issues.md`     | Canonical markdown report — severity/type breakdown + full issue list (227 open as of 2026-03-19) |
| `docs/audit/sonarcloud-hotspots.json`      | 37 security hotspots (all REVIEWED/SAFE)                           |

The issue data is now a Markdown report. Use the "All Open Issues" section in `docs/audit/sonarcloud-open-issues.md` to look up per-file or per-rule entries, or re-generate the file via the SonarQube MCP `analyze_file_list` / `search_sonar_issues_in_projects` tools.

---

## 🎯 February Objectives

1. **Audit Remediation** - Clear all High/Medium priority findings from January audits
2. **Archive System Completion** - Restore from archive, activity log rotation
3. **SonarCloud Remediation** - Resolve 614 open issues (9 Critical, 130 Major, 473 Minor)
4. **Code Quality Baseline** - Establish clean SonarCloud scan for ongoing CI checks

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

- [x] **Activity Log Unbounded Growth** - ✅ Auto-archive entries older than 90 days to yearly archive files
- [x] **Synchronous AVS Parsing** - ✅ Implemented chunked async parsing (`parseAVSInputAsync`) with configurable chunk size
- [x] **Rename vague variables** - ✅ Renamed 20+ `result` → descriptive names across 10 hook files
- [x] **Standardize `error` vs `err`** - ✅ Migrated 19 instances to `catch (error)` pattern
- [x] **Move `US_STATES` to shared constants** - ✅ Created `domain/common/usStates.ts`
- [x] **Move `colorPalette` to module-level constant** - ✅ NotesSection.tsx no longer exists (refactored)
- [x] **Consolidate Error Boundary base class** - ✅ Created `BaseErrorBoundary` abstract class; both boundaries now extend it

#### Paper Cuts (Added Feb 6)

- [x] **Better Focus Lock in Financial Item Modal** - ✅ Already complete via Radix Dialog built-in focus trap
- [x] **Add Apt Field to Address Schema** - ✅ Added optional `apt` field to Address/MailingAddress types, Zod schemas, and form inputs
- [x] **Archive Panel Search Bar** - ✅ Already complete with fuzzy search + status filter
- [x] **Tune AVS Import Current Item Matching** - ✅ Tiered matching with confidence levels (exact/high/medium/low), normalized descriptions, partial account number matching

#### Refactoring & Polish

- [x] Add tests for new utilities (`requireDataManager`, `getCategoryColor`) - N/A (already exist with tests)
- [x] Update audit reports to mark items complete - ✅ UI_AUDIT_REPORT.md updated
- [x] Verify build and all tests pass - ✅ Tests passing

---

### Week 2: Archive & Data Lifecycle (Feb 9-15)

_Focus: Complete archive system and data management improvements_

#### Prep Work

- [x] Fix any bugs discovered from Week 1 - ✅ Fixed archive status filter Select crash (empty Select.Item value)
- [x] Design restore-from-archive UX flow - ✅ Multi-select restore with confirmation dialog implemented in archive browser

#### Features

- [x] **Restore from Archive** - ✅ Cases, notes, and financials restored to active file via archive browser flow
- [x] **Search within Archives** - ✅ Search + status filter implemented for loaded archive cases
- [x] **Archive File Metadata** - ✅ Archive date and case count displayed in archive browser UI
- [x] **Activity Log Auto-Archiving** - ✅ Implemented with expandable timeline UI (3→10 entries)

#### Refactoring & Polish

- [x] Add tests for restore operations - ✅ Added `CaseArchiveService.restoreCases` service tests
- [x] Update Case Archival feature catalogue rating - ✅ Updated to 88/100 with restore/search metadata coverage

---

### Week 3: SonarCloud Remediation Sprint (Feb 16-22)

_Focus: Resolve all SonarCloud issues — 614 open (434 prod, 155 scripts, 25 tests)_

> **Source:** [sonarcloud-open-issues.md](../audit/sonarcloud-open-issues.md) snapshot from 2026-03-19
> **Latest refresh:** 2026-03-19T14:43:53Z — 227 open (14 critical, 27 major, 184 minor, 2 info)

#### Wave 1: Critical & Major Severity (Mon-Tue)

_9 Critical + 108 Major production code issues_

> **GPT:** Start each rule group by searching `docs/audit/sonarcloud-open-issues.md` for exact file:line locations. Commit per rule family. Run `npm test` after each commit.

##### Session Progress Update (Feb 17)

- [x] Restored clean build after interim refactors (`npm run build` green)
- [x] `S3358` nested ternary remediation pass completed in:
  - [x] `components/case/CaseTable.tsx`
  - [x] `utils/alertsData.ts`
  - [x] `components/case/BulkActionsToolbar.tsx`
  - [x] `components/modals/AVSImportModal.tsx`
  - [x] `components/app/widgets/ActivityWidget.tsx`
  - [x] `components/app/widgets/AlertsClearedPerDayWidget.tsx`
  - [x] `components/app/widgets/CasesProcessedPerDayWidget.tsx`
  - [x] `utils/logger.ts`
  - [x] `utils/fileStorageErrorReporter.ts`
  - [x] `contexts/FileStorageContext.tsx`
- [x] Targeted readonly-prop and accessibility cleanups in `CaseTable`, `AVSImportModal`, and widget files
- [x] `S4325` type-assertion cleanup completed for `utils/alertsData.ts`
- [x] `S7753` `findIndex`→`indexOf` cleanup completed for `utils/alertsData.ts`
- [x] `S6479` stable-key remediation pass completed for listed component key hotspots
- [x] `S6564` redundant type alias fix completed in `useFinancialItemCardState.ts`
- [x] `S6582` optional chaining sweep completed (`Settings.tsx`, `GlobalContextMenu.tsx`, `domain/dashboard/widgets.ts`, `FinancialsService.ts`)
- [x] **Wave 1 complete (Feb 18 session)** — S6582, S2933, S6481, S7762, S6671, S6557, S3358 (remaining), S6819, S4624, S107, S6772, S6848, S6478 all resolved; S7760 and S4662 deferred to Wave 2; 1141 tests passing

##### Critical (9 issues → 0)

- [x] **Cognitive Complexity S3776** (3 prod) - ✅ Refactored `CaseList.tsx`, `FinancialItemStepperModal.tsx`, and `AvgCaseProcessingTimeWidget.tsx`
- [x] **Empty Methods S1186** (4 test) - ✅ Added explicit no-op statements in `__tests__/integration/autosaveStatus.test.tsx`
- [x] **Nested Functions S2004** (1 script) - ✅ Flattened nested callback depth in `scripts/chromePerformanceTrace.ts`
- [x] **validateAgenticContext S3776** (1 script) - ✅ Reduced complexity by extracting section validation/report helpers

##### Major — Nested Ternaries S3358 (27 prod issues)

- [x] **Widget ternaries** - ✅ `ActivityWidget` (3), `AvgCaseProcessingTimeWidget` (4), `AlertsClearedPerDayWidget` (2), `CasesProcessedPerDayWidget` (2) — extracted to named variables
- [x] **CaseTable ternaries** - ✅ `CaseTable.tsx` (6 nested ternaries) — refactored to early returns and helper functions
- [x] **Other ternaries** - ✅ `BulkActionsToolbar`, `FinancialItemStepperModal` (2), `GlobalSearchDropdown`, `AVSImportModal`, `FileStorageContext`, `alertsData` (2), `logger`, `fileStorageErrorReporter` — all resolved

##### Major — Accessibility S6819 (15 prod issues)

- [x] **Semantic HTML roles** - ✅ `NotesPopover` div→button, `VRGeneratorModal` div→button[role=checkbox], `ErrorReportViewer` div→button, `AlertBadge` span→button, `AutosaveStatusBadge` (role=status is valid live-region, // NOSONAR), `GlobalSearchDropdown` (combobox/listbox/option roles are correct ARIA pattern, // NOSONAR), `TemplateEditor` div→button
- [x] **UI library roles** - ✅ `breadcrumb.tsx` (role=link and role=presentation are intentional shadcn ARIA, // NOSONAR added)

##### Major — Array Index Keys S6479 (15 prod issues)

- [x] **Component keys** - ✅ Added stable keys in `CaseEditSections`, `WidgetSkeleton`, `PersonColumn`, `KeyboardShortcutsHelp`, `KeyboardShortcutsPanel`, `IntakeChecklistView`, `LegacyMigrationPanel`, and `MultiSortConfig`; `ActivityWidget` already uses stable item keys

##### Major — Other Rules

- [x] **Optional chaining S6582** - ✅ All 11 occurrences resolved in `widgets.ts`, `FinancialsService`, `GlobalContextMenu`, `Settings` (commit 537ed31)
- [x] **Readonly fields S2933** - ✅ All 7 occurrences: `ErrorBoundary.handleCopyError`, `alertWriteQueue.queues/.processing`, `errorReporting.maxReports/.recentErrors/.deduplicationWindow`, `CaseOperationsService.dataManager` (commit 537ed31)
- [x] **Context value memoization S6481** - ✅ All 6 contexts wrapped in `useMemo`: `SelectedMonthContext`, `FileStorageContext` (already done), `DataManagerContext`, `ThemeContext` (with `useCallback` for stable deps), `chart.tsx`, `toggle-group.tsx`
- [x] **childNode.remove() S7762** - ✅ All 6 occurrences modernized: `ActivityWidget`, `ErrorBoundary`, `ErrorReportViewer`, `Settings`, `clipboard`, `dataExportImport`
- [x] **Promise rejection errors S6671** - ✅ All 3 occurrences wrapped in `new Error()` in `IndexedDBHandleStore.ts`
- [x] **String#startsWith S6557** - ✅ `digits[0] === '1'` replaced with `digits.startsWith('1')` in `phone.ts` (3 occurrences)
- [x] `S6564` redundant type alias fix completed in `useFinancialItemCardState.ts`
- [x] **Nested template literals S4624** - ✅ Flattened in `PinnedCasesDropdown.tsx`
- [x] **Too many parameters S107** - ✅ `deriveStatusDisplay` in `useAutosaveStatus.ts` refactored to accept `DeriveStatusDisplayOptions` object
- [x] **Ambiguous spacing S6772** - ✅ Added `{' '}` separators in `CaseFilters.tsx` (3 occurrences)
- [x] **Non-native interactive S6848** - ✅ `TemplateEditor.tsx` header div replaced with `<button type="button">`
- [x] **Calendar inner components S6478** - ✅ `CalendarRoot`, `CalendarChevron`, `CalendarWeekNumber` extracted to module scope in `calendar.tsx`

#### Wave 2: High-Volume Minor Rule Sweeps (Wed-Thu)

_Tackle the top 5 rules by count across production code_

> **GPT:** These are mechanical sweeps. For each rule, apply the fix pattern uniformly. Search `docs/audit/sonarcloud-open-issues.md` for the rule ID to get the affected file list. Commit one rule at a time.

##### S6759 — Nested React Components (117 issues)

- [ ] **Batch extraction** - Extract inline component definitions to module-level named components (see _S6759 Extraction Strategy_ in Architectural Context above)
- [ ] Prioritize `CaseEditSections.tsx` (14 issues), `ActivityWidget.tsx` (10), `CaseTable.tsx` (9), `WidgetSkeleton.tsx` (8), `AVSImportModal.tsx` (8)

##### S7735 — Unexpected Negated Condition (35 issues)

- [ ] **Sweep across prod files** - Flip if/else branches for negated conditions; replace `x === true` / `x === false` with direct boolean expressions or negation

##### S1874 — Deprecated API Usage (27 issues)

- [ ] **Update deprecated calls** - Replace deprecated APIs with current equivalents. Check if any are domain-layer (should have no side-effect impact) vs service-layer (may need integration re-testing)

##### S7773 — Prefer `Number.isNaN`/`parseInt`/`parseFloat` (26 issues)

- [ ] **Batch fix** - Replace global `isNaN()`, `parseInt()`, `parseFloat()` with `Number.isNaN()`, `Number.parseInt()`, `Number.parseFloat()`. Domain-heavy: 16 of 26 issues are in `domain/` (dates.ts ×4, formatting.ts ×6, vr.ts ×3, parser.ts ×2, formatters.ts ×1)

##### S7781 — Prefer `String#replaceAll()` (16 issues)

- [ ] **Batch fix** - Replace `.replace(/…/g, …)` with `.replaceAll(…, …)`. Domain-heavy: 13 of 16 issues are in `domain/` (sanitization.ts ×9, parser.ts ×2, vr.ts ×1, matching.ts ×1). Pure formatting — safe for bulk commit

##### Remaining Minor Rules (prod)

- [ ] **Default parameters S7760** (1) - Use default params in `alerts/matching.ts:196` ← deferred from Wave 1
- [ ] **CSS @plugin rule S4662** (2) - Suppress or configure for Tailwind v4 in `globals.css` ← deferred from Wave 1
- [ ] **S3863** (14) - Merge duplicate imports — consolidate multiple imports from the same module (includes `domain/templates/vr.ts` ×2)
- [ ] **S2486** (11) - Empty catch blocks — add error handling, logging via `createLogger()`, or `// intentionally empty` comments
- [ ] **S4325** (10) - Remove unnecessary type assertions (`as Type`) — use type narrowing or `satisfies` instead
- [ ] **S6754** (9) - Fix React hook dependency arrays — add missing deps or extract values to stable refs
- [ ] **S7778** (7) - Batch `Array#push()` calls — combine multiple sequential `.push()` into single call with spread/multiple args (includes `domain/dashboard/activityReport.ts` ×3)
- [ ] **S7764** (6) - Prefer `Array.isArray()` over `instanceof Array`
- [ ] **S6594** (4) - Use `RegExp.exec()` instead of `String.match()` for regex results (includes `domain/avs/parser.ts` ×3)
- [ ] **S6767** (4) - Prefer `for...of` over index-based loops
- [ ] **S7741** (4) - Remove unnecessary `await` on non-Promise expressions
- [ ] **S7758** (4) - Prefer `String.fromCodePoint()` over `String.fromCharCode()` and `String#codePointAt()` over `String#charCodeAt()` (Unicode code point handling)
- [ ] **S7772** (4) - Prefer `node:path` over `path` and similar `node:` protocol-prefixed imports

##### Domain-Layer Gap Issues (9 issues — added Feb 18)

> These domain-layer issues were discovered during cross-referencing SonarCloud data against the roadmap. All MINOR severity, all mechanical single-line fixes in pure domain functions.

- [ ] **S6606** (2) - Prefer nullish coalescing assignment (`??=`) — `domain/avs/parser.ts:448`, `domain/financials/history.ts:157`
- [ ] **S7744** (2) - Remove useless empty object in spread — `domain/alerts/matching.ts:254-255`
- [ ] **S4323** (1) - Extract union type to named type alias — `domain/templates/vr.ts:182`
- [ ] **S6551** (1) - Fix object default stringification — `domain/common/sanitization.ts:179`
- [ ] **S7719** (1) - Remove unnecessary `.getTime()` call — `domain/dashboard/activityReport.ts:22`
- [ ] **S7786** (1) - Use `TypeError` instead of generic `Error` — `domain/dashboard/activityReport.ts:39`
- [ ] **S7771** (1) - Prefer negative index for `slice` — `domain/common/phone.ts:85`

#### Wave 3: Scripts & Test Files (Thu-Fri)

_155 script issues across 3 files + 25 test-file issues_

> **GPT:** Script files (`scripts/`) are excluded from `tsconfig.json` compilation (`"exclude": ["scripts/**"]`) and do not affect production builds. They run standalone via `tsx`. Test files are in `__tests__/` and follow patterns in `.github/testing-guide.md`.

##### Scripts (155 issues — 3 files)

- [ ] **analyzeNavigationTrace.ts** (50 issues) - Major cleanup: S7778, type improvements
- [ ] **dashboardLoadBenchmark.ts** (40 issues) - S7778 sweep + type fixes
- [ ] **autosaveBenchmark.ts** (30 issues) - S7778 sweep + type fixes
- [ ] **Remaining scripts** (35 issues) - `chromePerformanceTrace`, `validateAgenticContext`, etc.

##### Test Files (25 issues)

- [ ] **S4325** (5) - Remove unnecessary type assertions in tests
- [ ] **S7764** (4) - Apply rule-specific fix
- [ ] **S1186** (4) - Address empty methods in mocks
- [ ] **S1874** (3) - Update deprecated APIs in tests
- [ ] **Remaining test rules** (9) - S6819, S2933, S7744, S6759, S7721, S7735

#### Wave 4: Verification & Documentation (Fri)

> **GPT:** Run these commands in order. Do not proceed to the next if any fail.

- [ ] `npm test` — verify all 1141+ tests pass (zero failures)
- [ ] `npm run build` — verify zero build errors, check bundle size delta
- [ ] `npx tsc --noEmit` — verify zero type errors
- [ ] Re-fetch SonarCloud scan and update `docs/audit/sonarcloud-open-issues.md` with post-remediation counts
- [ ] Commit any remaining changes in logical batches
- [ ] Document any issues deferred or marked as false positives in a `docs/audit/sonarcloud-deferred.md` file
- [ ] **Claude review:** Tag Claude for architectural review of any changes to Context providers, DataManager, or shared utilities

---

### Week 4: Polish, UX Features & March Planning (Feb 23-28)

_Focus: Ship deferred UX features, final polish, and March planning_

#### Prep Work

- [x] Fix any bugs or regressions from Week 3 remediation - ✅ Pre-release soak fixes (Feb 19):
  - [x] Breadcrumb DOM nesting warning (`<li>` inside `<li>`) resolved via separator element update
  - [x] Checkbox ref warning resolved by converting `components/ui/checkbox.tsx` to `React.forwardRef`
  - [x] FinancialItemCard ref warning resolved by removing unused `ref` passed to `Card`
- [ ] Run full audit cycle (SonarCloud re-scan)
- [ ] Verify SonarCloud issue count reduction targets met

#### Features (Carried from Week 3)

- [ ] **Chord Navigation** - `Ctrl+G` leader key → `D` (dashboard), `L` (list), `S` (settings)
- [ ] **Saved Filter Views** - User-configurable filter presets in Case List
- [ ] **Relationship Search** - Filter/search by relationship data in Case List

#### Refactoring & Polish

- [ ] Add keyboard navigation tests
- [ ] Create February changelog
- [ ] Update feature catalogue ratings
- [ ] Plan March roadmap
- [ ] Archive February roadmap

---

## 📊 Success Metrics

| Metric                      | Start | Week 1 | Week 2  | Week 3  | Target |
| --------------------------- | ----- | ------ | ------- | ------- | ------ |
| Test count                  | 1118  | 1118   | 1117 ✅ | 1141 ✅ | 1200+  |
| Average feature rating      | 85.1  |        | 85.5    |         | 87+    |
| Open audit findings         | 18    | 17     | 17      |         | 0      |
| Console statements in hooks | 22    | 0 ✅   | 0 ✅    | 0 ✅    | 0      |
| SonarCloud open issues      | 614   | —      | —       | 206 🔄  | < 50   |
| SonarCloud critical issues  | 9     | —      | —       | 1 🔄    | 0      |
| SonarCloud major issues     | 130   | —      | —       | 24 🔄   | 0      |
| Case Archival rating        | 82    |        | 88 ✅   |         | 88     |
| New features shipped        | -     |        | 4       |         | 8-10   |

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

### Week 3 - P0 (SonarCloud Remediation)

1. Reduce critical issues from 9 to 1 and clear remaining critical finding
2. Continue major-issue reduction (currently 24 major remaining)
3. High-volume minor rule sweeps: S6759 (117), S7735 (35), S1874 (27), S7773 (26)
4. Scripts cleanup (155 issues across 3 files) + test file fixes (25 issues)

---

## 🚫 Out of Scope (March+)

- **Keyboard Shortcut Customization** - Settings panel for rebinding (deferred from Week 3)
- **Quick-Switch Filters** - Buttons for saved view presets (deferred from Week 3)
- **Export Filter Presets** - Share saved views between installations (deferred from Week 4)
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
- [SonarCloud Open Issues](../audit/sonarcloud-open-issues.md) - Issue snapshot (227 open, 2026-03-19)
- [SonarCloud Hotspots](../audit/sonarcloud-hotspots.json) - Security hotspot review

---

_Last updated: February 19, 2026 (Live Sonar snapshot refreshed)_

---

## 📝 Notes

### AI-Assisted Dual-Agent Development Model

This roadmap reflects a dual-agent workflow adopted mid-February 2026:

- **Claude Opus 4.6 (PM):** Owns this roadmap, architectural decisions, provider nesting order, context value shapes, and cross-cutting dependency management. Reviews all changes to `contexts/*`, `utils/DataManager.ts`, `utils/services/*`, and shared utilities.
- **GPT 5.3 Codex (Lead Dev):** Executes implementation tasks defined in this roadmap. Each Wave contains sufficient file:line references and architectural constraints for autonomous execution. Commits per rule family.

**Communication contract:**

1. GPT reads this roadmap as its task specification.
2. GPT can reference `docs/audit/sonarcloud-open-issues.md` for exact issue locations.
3. GPT should read `.github/copilot-instructions.md` and `.github/implementation-guide.md` for patterns.
4. Changes to Context providers or shared utilities require Claude review before merge.
5. Test suite must pass after every commit (`npm test`).

### Quality Gates

Every change must:

1. Pass all existing tests
2. Not break the provider nesting order or context value contracts
3. Follow established patterns (hooks delegate to services, domain stays pure)
4. Be committed in logical batches (one rule family per commit)
5. Not introduce new SonarCloud issues

---

**Prepared by:** Claude Opus 4.6 (Project Manager)  
**Executed by:** GPT 5.3 Codex (Lead Developer)  
**Last updated:** February 19, 2026 (Live Sonar snapshot refreshed)
