# CMSNext Feature Catalogue

> Living index of marketable features, their current implementation status, quality, and future investments.

**Last Updated:** December 11, 2025

## How to Use This Document

- **Implementation Snapshot** — Update whenever new functionality lands
- **Strengths** — Capture wins to celebrate and reuse patterns
- **Gaps / Risks** — Log known limitations so they can be triaged or scheduled
- **Expansion Opportunities** — Propose next steps and link them to tickets once planned
- **Coverage & Telemetry** — Track automated coverage and observability

✍️ _Add dates and owners when significant updates occur to maintain historical context._

---

## Quick Reference (December 2025)

| Feature               | Rating | Trend | Notes                                        |
| --------------------- | ------ | ----- | -------------------------------------------- |
| Case Management       | 92     | ↑     | Enhanced header with copy, priority toggle   |
| Financial Operations  | 90     | ↑     | Date from history, auto-migration            |
| Developer Enablement  | 86     | ↑     | 455 tests, testing guidelines, withToast     |
| Premium UI/UX         | 86     | ↑     | NotesPopover, global context menu            |
| Data Portability      | 82     | ↑     | AVS import with update capability            |
| Local-First Storage   | 80     | →     | Production-ready                             |
| Configurable Statuses | 78     | →     | Recently stabilized                          |
| Notes & Collaboration | 82     | ↑     | Popover UI with inline edit, category select |
| Legacy Migration      | 75     | →     | Dev-only, one-way                            |
| Autosave & Recovery   | 74     | →     | Works, telemetry pending                     |
| Feature Flags         | 72     | →     | In-memory only                               |
| Dashboard & Insights  | 70     | →     | Framework ready                              |

**Average Rating:** 83.1/100  
**Test Status:** 455/455 passing (100%)

---

## Scoring Model

- **0–49** – Foundational capabilities missing or unreliable; feature not marketable yet
- **50–69** – Core capability present but fragile or incomplete; major gaps limit adoption
- **70–84** – Solid implementation serving real users with clear, addressable improvements outstanding
- **85–94** – Advanced, polished experience; remaining work is fine-tuning or long-tail edge cases
- **95** – Near-ideal. Reserved for exceptional maturity with only incremental gains left. _(We never assign 100.)_

---

## Table of Contents

1. [Local-First Storage & Privacy](#local-first-storage--privacy)
2. [Intelligent Autosave & Recovery](#intelligent-autosave--recovery)
3. [Comprehensive Case Management](#comprehensive-case-management)
4. [Financial Operations Suite](#financial-operations-suite)
5. [Notes & Collaboration Aids](#notes--collaboration-aids)
6. [Intelligent Dashboard & Insights](#intelligent-dashboard--insights)
7. [Data Portability & Migration](#data-portability--migration)
8. [Premium UI/UX Layer](#premium-uiux-layer)
9. [Developer & Operations Enablement](#developer--operations-enablement)
10. [Feature Flags](#feature-flags)
11. [Legacy Data Migration](#legacy-data-migration)
12. [Configurable Completion Statuses](#configurable-completion-statuses)

---

## Local-First Storage & Privacy

### Implementation Snapshot

**Rating: 80/100**

File System Access integration is production-ready with context-managed lifecycle (`FileStorageContext`), autosave-backed persistence, and timestamped backups. Connection flows (new vs. existing) are polished with clear permission prompts and recovery messaging, though browser support and security hardening remain works in progress.

### Strengths

- True offline-first experience; no servers or accounts required
- Robust lifecycle state machine handles ready, blocked, recovering, and error states, exposing selectors for UI consumers
- Directory reconnect flow remembers previous handles and guides users through permission re-grant
- Automatic backup strategy safeguards against data loss before imports or destructive saves
- Comprehensive documentation in `DeploymentGuide.md`, `file-storage-toast-catalogue.md`, and `error-boundary-guide.md`

### Gaps / Risks

- File System Access API limited to Chromium browsers; Safari/Firefox require fallback guidance
- Manual recovery steps still depend on user action, especially when handles are deleted outside the app
- No built-in encryption; privacy relies on local machine security
- Large dataset performance (1k+ cases) not yet benchmarked for IO bottlenecks

### Expansion Opportunities

- Explore optional encrypted archive export for sensitive deployments
- Investigate progressive enhancement for non-supported browsers (e.g., read-only preview via drag-drop JSON)
- Add automated health checks for stale directory handles and orphaned backup files
- Publish troubleshooting videos or in-app walkthrough for permission recovery

### Coverage & Telemetry

- Vitest suites cover connection lifecycle (`integration/connectionFlow.test.tsx`) and storage service retries (`AutosaveFileService.test.ts`)
- Hooks coverage: `useFileDataSync` and `useNavigationFlow` validate blocked/ready transitions
- Performance telemetry baseline captures storage badge timings (`2025-10-08-autosave-latency.json`)
- Pending: manual interaction trace + profiler sessions to validate recovery UX under live conditions

### Owners / Notes

Current maintainers: storage platform squad (contact via `FileStorageContext` codeowners). Coordinate enhancements after the outstanding Phase 4 manual telemetry captures are complete.

---

## Intelligent Autosave & Recovery

### Implementation Snapshot

**Rating: 74/100**

AutosaveFileService delivers debounced writes, retry escalation, and integration with FileStorage context. Badge UX surfaces saving/saved/retrying/permission states, yet live telemetry, per-item history, and degraded-case validation are still forthcoming.

### Strengths

- 5s debounced autosave with queued writes prevents thrashing
- Retry policy escalates to recovering state and surfaces intent via Sonner toasts
- Manual save handoff (`saveCaseWithNavigation`) aligns with autosave flows, ensuring consistent measurement logs
- Autosave status badge available across dashboard and toolbar with clear copy documented in `error-boundary-guide.md`

### Gaps / Risks

- Autosave cancellation (user closing tab mid-write) lacks confirmation of persisted state
- Degraded storage scenario currently synthetic; real-browser telemetry pending
- No granular per-case autosave history—troubleshooting relies on logs rather than UI timeline
- Large batch edits may exceed debounce window, risking repeated writes

### Expansion Opportunities

- Implement an autosave timeline or recent activity list for troubleshooting
- Add configurable debounce interval or adaptive strategy based on pendingWrites volume
- Capture live degraded-storage metrics and compare against synthetic benchmark to tune retries
- Explore optimistic UI indicators for individual fields to show "saved" state at finer granularity

### Coverage & Telemetry

- Unit suites: `AutosaveFileService.test.ts` covers retries, failures, and lifecycle transitions
- Hooks: `useFileDataSync` ensures autosave triggers on incoming storage change events; `useNavigationFlow` asserts measurement metadata for `navigation:saveCase`
- Performance: `2025-10-08-autosave-latency.json` records synthetic badge timings; pending live trace and profiler capture
- Toast catalog documents error/resolution messaging for autosave failures

### Owners / Notes

Maintained by the storage + autosave working group. Align telemetry follow-ups with the remaining Phase 4 manual tasks.

---

## Comprehensive Case Management

### Implementation Snapshot

**Rating: 92/100** _(Updated December 4, 2025)_

Core case workflows (create, view, edit, delete) are production-ready through the refactored service architecture. CaseService handles all case CRUD operations with status tracking, import/export, and activity log integration. The hook layer (`useCaseManagement`) provides a clean facade over DataManager with optimistic updates and comprehensive test coverage. **December 4, 2025:** Added pagination (20 items/page) for improved performance with large case lists.

### Strengths

- **Pagination**: 20 items per page with "Showing X-Y of Z" count, page navigation, resets on filter changes
- **Smart Navigation**: Creating a new case automatically navigates to the case details view
- **Bulk Actions**: Multi-select cases for batch delete or status change with floating toolbar and confirmation dialogs
- **Service Layer Architecture**: `CaseService` (500+ lines) encapsulates all case business logic including bulk operations
- **DataManager Orchestration**: Thin coordination layer delegates to 7 specialized services via dependency injection
- **Relationships Model**: Formal relationship tracking (type, name, phone) integrated into Person data model
- **Selection Management**: `useCaseSelection` hook provides multi-select state with select-all, partial selection indicators
- **Streamlined Hook Layer**: `useCaseManagement` provides clean React integration with toast feedback and error handling
- **Navigation Integration**: `useNavigationFlow` ensures consistent transitions and performance measurement logging across views
- **Comprehensive Test Coverage**: 282/282 tests passing (100%) including service tests, integration tests, and component tests
- **Data Model Integrity**: Normalized structures (`CaseDisplay`, `CaseRecord`, `Person`, `Relationship`) with strict TypeScript validation
- **Import/Export**: Bulk operations with duplicate detection and progress indicators
- **Autosave Integration**: Forms seamlessly integrate with AutosaveFileService for reliable persistence
- **Filter/Sort Persistence**: Case list preferences saved to localStorage with reset button
- **Configurable Completion Statuses**: Users define which statuses count as "completed" for dashboard metrics

### Gaps / Risks

- Case list filtering/search UX exposes basic predicates; advanced combos could benefit from saved filter presets
- Accessibility audits for complex forms remain ad hoc

### Expansion Opportunities

- **Saved Filter Views**: Introduce user-configurable filter presets
- **Relationship Search**: Enable filtering/searching by relationship data
- **Virtualization**: Consider virtual scrolling for 1k+ datasets if pagination proves insufficient
- **Bulk Edit Fields**: Extend bulk actions to edit other case fields

### Coverage & Telemetry

- **Service Layer**: CaseService fully tested with 100% coverage for CRUD operations, bulk operations, import/export, and activity logging
- **Test Suite Status**: 347 tests passing across 45 test files (100%) as of December 4, 2025
- **Bulk Operations**: `deleteCases()` and `updateCasesStatus()` with single read/write pattern
- **Performance**: Pagination provides immediate relief; telemetry infrastructure ready for benchmarking

### Owners / Notes

Phase 3 Cases domain refactor completed November 2, 2025. Bulk actions added December 3, 2025. Pagination added December 4, 2025.

**December 5, 2025:** CaseDetails header enhanced with application date, phone, and email (all with click-to-copy). Priority toggle star button added. Alerts indicator moved to right side with action buttons.

**December 10, 2025:** Notes button moved from floating bottom-left to header next to alerts. Alerts badge redesigned as overlay with count (amber) or green checkmark when all resolved.

---

## Financial Operations Suite

### Implementation Snapshot

**Rating: 90/100** _(Updated December 11, 2025)_

Financial modules (resources, income, expenses) leverage dedicated components and hooks (`useFinancialItemFlow`, `FinancialItemCard`) with inline editing, validation, and autosave integration. Verification metadata and frequency handling cover core program requirements.

**December 11, 2025:** Card date now reflects most recent history entry. Auto-migration for legacy items creates history from dateAdded. Amount 0 now valid for history creation.

### Strengths

- **Smart Date Display**: Card shows most recent history entry's start date (not original dateAdded)
- **Auto-Migration**: Legacy items without history get migrated on first load (uses dateAdded as start date, YYYY-MM-DD format)
- **Zero Amount Support**: Financial forms accept $0 as valid amount, creating proper history entries
- **Inline Edit Mode**: Edit button swaps card display to full form; verification status and source in two-column layout at bottom
- **Historical Amount Tracking**: History button on Amount field opens modal showing chronological amount entries with Start Date, End Date, Amount, and Verification Source
- **Auto-Tracking**: Quick edits automatically create history entries with 1st of current month as start date; previous ongoing entries auto-close
- **Per-Entry Verification**: Each historical amount can have its own verification source (e.g., "Bank Statement 05/2025")
- **Click-to-Copy**: Copy button on each financial card formats item using Case Summary Generator conventions
- **Category Copy**: Header copy button copies all items in Resources/Income/Expenses category
- **Hover Actions**: Copy and delete buttons appear on card hover, always visible when expanded
- **Auto-Save Status**: Status dropdown works in collapsed state with immediate auto-save
- **Service Architecture**: FinancialsService (441 lines) handles all financial CRUD operations including history entry management
- **Hook Layer**: `useFinancialItemFlow` (165 lines) provides React integration with toast feedback
- **Inline Editing**: `FinancialItemCard` keeps UX fast with state managed by `useFinancialItemCardState`
- **Category Separation**: Clear separation of resources, income, and expenses
- **Verification Status**: Badges (VR/AVS/etc.) surface compliance at a glance
- **Grid View**: Simplified to grid-only mode (sub-tabs removed December 2025)

### Gaps / Risks

- Budget rollups and scenario planning not yet implemented
- Month picker for historical amounts is stubbed (SelectedMonthContext) - currently shows current month
- Table/list UX can be heavy on large datasets

### Expansion Opportunities

- Implement month picker to view historical amounts for past months
- Enhance bulk edit capabilities
- Surface contextual insights within a case
- AVS Import could support additional file formats
- Amount trend visualization (chart showing amount changes over time)

### Coverage & Telemetry

- RTL suites target FinancialItemCard, case financial forms, and verification flows
- `FinancialItemCardActions` tests cover copy button and clipboard integration
- `useFinancialItemFlow` tested through component behavior
- `financialHistory.test.ts` - 32 tests for utility functions (date manipulation, entry lookup)
- `FinancialsService.test.ts` - 27 tests for service history methods (including auto-tracking on add)
- `AmountHistoryModal.test.tsx` - 18 tests for modal component (rendering, CRUD, validation)
- No dedicated telemetry yet

### Owners / Notes

**December 4, 2025:** Financial card UX improvements complete - hover actions, click-to-copy, auto-save status.

**December 5, 2025:** Added category-level copy button to Resources/Income/Expenses headers. Copies all items in the category with identical formatting to individual items.

**December 10, 2025:** Historical amount tracking feature complete with full test coverage (77 new tests). AmountHistoryEntry type, financialHistory utilities, FinancialsService history methods, AmountHistoryModal component, and SelectedMonthContext stub for future month picker. Auto-tracking creates history entries when adding new items with non-zero amounts. Inline edit mode refactored to swap card display to form (no more chevron/accordion), edit button in floating actions, verification status dropdown always visible in form.

---

## Notes & Collaboration Aids

### Implementation Snapshot

**Rating: 82/100** _(Updated December 11, 2025)_

Notes system supports categorized, timestamped entries tied to cases with edit history and toast feedback. Activity log integration keeps audit context nearby, and quick-add UX leverages keyboard shortcuts and autosave-friendly forms. **December 11, 2025:** Replaced NotesDrawer with lightweight NotesPopover for faster access and inline editing.

### Strengths

- Multiple categories (General, VR Update, Client Contact, Follow-up) with filtering in case detail views
- Notes tied to case timeline with timestamps, author context, and inline editing
- Sonner toasts provide immediate feedback on create/update/delete actions
- Keyboard shortcuts and focused forms streamline fast note capture
- Activity log complements notes by recording system-driven events (imports, autosave results)
- **NotesPopover** (December 2025): Lightweight popover UI replaces drawer
  - Click-to-edit inline notes (click note content or pencil icon)
  - Category dropdown in both add and edit forms
  - Quick-add with Ctrl/⌘+Enter keyboard shortcut
  - Expands to fit content (no fixed max height)
  - Hover-to-reveal action buttons (edit, delete with confirmation)
- **Case Summary Generator**: Modal-based export with section toggles (Case Info, Person, Relationships, Resources, Income, Expenses, Notes), editable preview, and one-click copy to clipboard
- **Consistent Formatting**: Plain-text format optimized for emails and ticketing systems (MM/DD/YYYY dates, $1,500.00 currency, verification source display)

### Gaps / Risks

- No real-time collaboration; concurrent edits can overwrite without warning
- Lack of threaded conversations or mentions limits multi-user communication
- Search across notes is basic—no full-text or cross-case queries
- Attachments/files cannot be associated with notes yet

### Expansion Opportunities

- Add comment threading or @mentions to facilitate teamwork
- Implement cross-case/global note search with filters by category/date
- Introduce note pinning or favorites for quick retrieval of key updates
- Explore lightweight attachment support (e.g., link to filesystem files within case directory)
- Add PDF/CSV export options for case summaries

### Coverage & Telemetry

- RTL suites cover notes components and ensure category filtering works; integration tests verify connection flow includes note creation
- Case Summary Generator has 35 unit tests covering all sections, formatting, and edge cases
- Activity log utilities tested via `useCaseActivityLog` hook coverage
- No telemetry yet for note creation rate or latency; candidate for future usage metrics service

### Owners / Notes

Collaboration feature group; capture planned enhancements in updated documentation and coordinate with security/privacy when considering attachments.

---

## Intelligent Dashboard & Insights

### Implementation Snapshot

**Rating: 70/100** _(Updated December 3, 2025)_

Dashboard features a production-ready widget registry framework with lazy loading, automatic error handling, and data freshness tracking. **December 3, 2025:** Streamlined Overview tab to focus on Activity Log only (AlertCenter and RecentCases widgets removed). Analytics tab provides comprehensive metrics widgets. Core metrics remain visible, and architecture scales for future expansion.

### Strengths

- **Streamlined Overview**: Dashboard Overview tab focuses on Activity Log for recent activity; detailed analytics moved to dedicated Analytics tab
- **Widget Registry Framework**: Lazy loading via `React.lazy()` + Suspense with per-widget error boundaries prevents cascading failures
- **Data Freshness Tracking**: All widgets display "Last updated: X minutes ago" via `useWidgetData` hook with configurable refresh intervals
- **Responsive Grid Layout**: Widgets adapt to screen size (1 column mobile → 3 columns desktop) using shadcn grid system
- **Real-Time Metrics**: Case Priority widget aggregates counts by urgency/status; Activity Timeline shows last 7 days of notes/status changes
- **Performance Instrumentation**: `telemetryInstrumentation` tracks widget load times, data fetch duration, and error rates
- **Composable Architecture**: New widgets can be added without modifying core registry; metadata-driven registration enables priority sorting
- **Seamless Integration**: Activity log feeds data to Activity Timeline widget; case state drives Priority widget

### Gaps / Risks

- No advanced analytics yet (trend lines, aging reports, predictive insights)—widgets focus on snapshot metrics only
- Dashboard customization not supported; layout is fixed across all users
- Widget bundle size growth uninspected; lazy loading helps but large dependencies could slow initial render
- Accessibility testing for new widgets pending (axe-core integration); keyboard navigation not yet verified
- Performance profiling for dashboard with 3+ widgets not yet captured

### Expansion Opportunities

- Build interactive pipeline chart showing case progression through statuses
- Add trend widget displaying workload distribution over time using lightweight visualization library
- Support widget pinning/hiding for personal dashboard views
- Integrate usage metrics telemetry to surface navigation hotspots and user workflows
- Create onboarding mode with guided widget tour for new users
- Develop alerting widget surfacing high-priority cases requiring immediate action

### Coverage & Telemetry

- Integration test (`__tests__/components/Dashboard.test.tsx`) verifies widget registry rendering and error handling
- Hook suites: `useWidgetData` tested for data fetching, freshness tracking, and refresh intervals
- Widget-specific tests: `__tests__/components/widgets/CasePriorityWidget.test.tsx` and `ActivityTimelineWidget.test.tsx` verify data aggregation and rendering
- Performance markers tracked via `recordPerformanceMarker()` for each widget data fetch
- Pending: manual dashboard load profiling and end-to-end performance baseline under realistic case volumes

### Owners / Notes

Dashboard framework maintained by insights platform team. Widget development follows pattern documented in `docs/development/widget-development.md`. Coordinate new widgets with UX for consistent design and with platform team to validate performance impact before shipping.

---

## Data Portability & Migration

### Implementation Snapshot

**Rating: 82/100** _(Updated December 8, 2025)_

JSON import/export flows are stable with schema validation, autosave-aware backups, and legacy migration helpers. **December 8, 2025:** AVS import enhanced with duplicate detection - matches existing items by accountNumber + description and updates them instead of creating duplicates. Preview UI shows New/Update badges, selection checkboxes, and Select All toggle. Parser improved to handle bank-specific "Account Owner:" format and "Checking Account" type suffixes.

### Strengths

- **AVS Duplicate Detection**: Matches existing items by accountNumber + description, updates instead of creating duplicates
- **AVS Preview Checkboxes**: Select/deselect individual accounts before import with New/Update badges
- **Smart Alert Import**: Unmatched alerts with MCNs automatically create skeleton cases with properly-cased names (handles ALL CAPS, Mc/Mac/O' prefixes)
- Import process validates structure, migrates legacy payloads, and records failures with descriptive toasts
- Automatic backups (`case-tracker-data.backup-[timestamp].json`) protect against destructive imports
- Exported data includes metadata (exported_at, totals) ensuring compatibility across environments
- `JsonUploader` component provides guided UX with progress feedback
- Seed scripts and `sample-alerts.json` accelerate demos and testing

### Gaps / Risks

- Import error reporting is technical; non-technical users may struggle to resolve malformed files
- No differential import—large datasets require full reloads even for small changes
- Lack of built-in anonymization tooling when sharing exports
- Migration helpers mostly tested via unit coverage; limited integration testing with real-world datasets

### Expansion Opportunities

- Add human-friendly remediation guidance for common import failures
- Support delta imports or append-only merges to reduce downtime on large datasets
- Provide optional anonymization/scrubbing commands for support handoffs
- Capture import/export metrics (duration, file size) to spot performance regressions

### Coverage & Telemetry

- Unit tests for `DataManager`, `DataNormalization`, and CSV parser cover transformation logic
- Integration tests ensure connection flow handles imports with backups
- No telemetry yet; future usage metrics could log import frequency and file sizes
- Manual QA relies on generated fixtures—consider automating smoke imports in CI

### Owners / Notes

Data platform group. Coordinate with documentation team to keep `SeedDataSystem.md` and import guides in sync with new features.

---

## Premium UI/UX Layer

### Implementation Snapshot

**Rating: 85/100** _(Updated December 10, 2025)_

Six-theme system (Light, Dark, Soft Dark, Warm, Blue, Paper) built on shadcn/ui delivers polished, responsive layouts. Tailwind CSS v4 tokens and component decomposition keep styling consistent. **December 10, 2025:** Added global context menu with platform-aware shortcuts and CopyButton tooltip prop.

### Strengths

- **Global Context Menu**: Right-click anywhere for Undo, Redo, Cut, Copy, Paste with platform-aware shortcuts (Ctrl on Windows, ⌘ on Mac)
- **CopyButton Tooltip**: Optional tooltip prop for hover hints (e.g., App Date shows "90 Days = MM/DD/YYYY")
- **CopyButton Component**: Unified click-to-copy pattern with display text, raw value, monospace option, and multiple variants
- **EmptyState Component**: Consistent empty state messaging with icon, title, description slots
- **AlertDialog Usage**: All destructive actions use shadcn AlertDialog instead of browser confirm()
- Theme switcher integrates with ThemeContext; transitions smooth without layout shift
- UI built on shadcn primitives ensures accessible defaults and consistent patterns
- Responsive design tested across desktop/tablet/mobile breakpoints
- Sonner toasts and Lucide iconography tie together interactions with modern feedback
- Component library decomposition (e.g., FinancialItemCard subcomponents) encourages reuse and maintainability

### Gaps / Risks

- Accessibility testing relies on manual reviews; automated tooling (axe, pa11y) not yet wired into CI
- Theme contrast ratios need formal verification to meet WCAG AA across all palettes
- Limited motion design guidelines; micro-interactions vary between features

### Expansion Opportunities

- Introduce automated accessibility checks in CI and document remediation workflows
- Publish UI style guide including motion, spacing, and tone guidelines for contributors
- Explore theme presets for organization branding while preserving accessibility guarantees

### Coverage & Telemetry

- CopyButton tested with 11 unit tests covering variants, props, and copy behavior
- Storybook-equivalent not in place; rely on RTL component tests for regression coverage
- No UI performance telemetry; manual baseline captured via bundle analysis

### Owners / Notes

**December 5, 2025:** UI consistency audit complete. Legacy McnCopyControl and CopyableText replaced with unified CopyButton. EmptyState component created and integrated. All confirm() calls replaced with AlertDialog. Aria-labels standardized throughout.

---

## Developer & Operations Enablement

### Implementation Snapshot

**Rating: 84/100** _(Updated December 5, 2025)_

Tooling stack (Vitest, ESLint 9 flat config, Tailwind v4 pipeline) covers day-to-day development with scripted performance baselines, seed data generators, and comprehensive architecture documentation. Service extraction established clean DataManager + Services pattern with dependency injection. **December 5, 2025:** 347 tests passing. Unified CopyButton component demonstrates pattern consolidation. `formatDateForDisplay()` utility added. Test coverage includes CopyButton (11 tests), CaseListCopy, and financial card actions.

### Strengths

- **Comprehensive test harness**: 340 tests passing across unit, RTL, integration, and performance scripts with coverage reporting
- **Service Architecture**: DataManager (461 lines) + 7 focused services totaling 2,265 lines
- **Dependency Injection**: Clean service composition with focused responsibilities
- **Storage Normalization**: v2.0 normalized format with automatic migration from legacy formats
- **Dev container** and documented setup enable consistent onboarding
- **CLI utilities** (`scripts/`) generate sample data, run performance baselines, and capture usage reports
- **Linting/formatting** standardized via ESLint 9 + Prettier; zero warning baseline

### Hook Complexity Status

Target: ≤200 lines per hook. **Week 1 refactoring complete:**

| Hook                | Before | After | Status      |
| ------------------- | ------ | ----- | ----------- |
| `useNavigationFlow` | 424    | 128   | ✅ Complete |
| `useConnectionFlow` | 413    | 145   | ✅ Complete |
| `useCaseManagement` | 350    | 83    | ✅ Complete |
| `useAlertsFlow`     | 289    | 106   | ✅ Complete |

**Remaining hooks over target:**

| Hook                     | Lines | Notes                               |
| ------------------------ | ----- | ----------------------------------- |
| `useFinancialItemFlow`   | 384   | Complex modal state, lower priority |
| `useCaseListPreferences` | 263   | Filter/sort logic, acceptable       |
| `useCaseOperations`      | 262   | CRUD operations, acceptable         |
| `useWidgetData`          | 245   | Data fetching, acceptable           |
| `useCategoryEditorState` | 244   | Form state, acceptable              |

### New Utilities (December 2025)

- **`withToast()`**: Async wrapper with isMounted guards, loading/error state management
- **`toastPromise()`**: Lightweight wrapper using Sonner's native `toast.promise()` API
- **`project-structure-guidelines.md`**: Documents patterns for toast, hooks, services

### Gaps / Risks

- No automated release packaging
- Usage telemetry service still conceptual
- Accessibility and visual regression tooling not in CI

### Expansion Opportunities

- Introduce lightweight release automation
- Add automated accessibility checks to CI
- Stand up usage metrics service
- Consider `useFinancialItemFlow` extraction (lower priority)

### Coverage & Telemetry

- **Vitest suites**: 347 tests across 45 test files (100% passing)
- **Service tests**: Complete coverage for all 7 services
- **Toast utilities**: 14 tests covering loading/success/error states, isMounted guards
- **Pagination tests**: 7 tests covering navigation, disabled states, empty state
- **Performance telemetry**: Partially automated; manual traces pending

### Owners / Notes

Platform enablement group coordinates tooling, CI, and documentation upkeep. Week 1 hook refactoring completed December 4, 2025.

---

## Feature Flags

### Implementation Snapshot

**Rating: 72/100** _(Updated December 4, 2025)_

Feature flag infrastructure lives in `utils/featureFlags.ts` with immutable defaults and helper utilities. Flags are managed through `useAppViewState` hook.

### Current Usage

**Actually used flags:**

| Flag                       | Default | Where Used                     | Purpose                              |
| -------------------------- | ------- | ------------------------------ | ------------------------------------ |
| `settings.devTools`        | `DEV`   | `Settings.tsx`, `CaseList.tsx` | Show dev tools, sample data button   |
| `settings.legacyMigration` | `DEV`   | `Settings.tsx`                 | Show v1→v2 migration panel           |
| `ENABLE_SAMPLE_ALERTS`     | `false` | `useAlertsFlow.ts`             | Sample alerts (disabled permanently) |

**Placeholder flags (infrastructure ready, not wired up):**

| Flag                      | Default | Intended Purpose                                   |
| ------------------------- | ------- | -------------------------------------------------- |
| `dashboard.widgets.*` (8) | `true`  | Dashboard widget customization (future feature)    |
| `reports.advancedFilters` | `false` | Advanced reporting filters (future feature)        |
| `cases.bulkActions`       | `false` | Was placeholder; bulk actions shipped without flag |

### Architecture Notes

- Type-safe `FeatureFlagKey` union prevents magic strings
- `DEFAULT_FLAGS` provides reproducible defaults for tests
- Runtime toggling via `useAppViewState().setFeatureFlags`
- Widget registry supports `metadata.featureFlag` for future dashboard customization

### Future: Dashboard Customization

When building dashboard customization:

1. Wire `dashboard.widgets.*` flags to actual widget visibility
2. Add persistence (localStorage or file) for user preferences
3. Build settings UI to toggle widgets on/off
4. Consider removing unused flags (`reports.advancedFilters`, `cases.bulkActions`)

### Coverage

- Unit tests: `__tests__/utils/featureFlags.test.ts`
- Hook tests: `__tests__/hooks/useAppViewState.test.ts`

---

## Legacy Data Migration

### Implementation Snapshot

**Rating: 75/100** _(Added November 26, 2025)_

A dedicated migration utility (`utils/legacyMigration.ts`) enables users with v1.x data files to migrate to the v2.0 normalized format. The utility is accessible through Settings when the `settings.legacyMigration` feature flag is enabled.

### Strengths

- **Comprehensive Transformation**: Migrates nested v1.x format (cases with embedded financials/notes) to flat v2.0 relational format
- **Safe Migration Flow**: Preview before apply, with detailed statistics on what will be migrated
- **Category Discovery**: Auto-discovers statuses and alert types from legacy data and merges with existing config
- **User-Friendly UI**: `LegacyMigrationPanel` component provides guided migration with progress feedback
- **Feature-Gated**: Only visible in dev mode via `settings.legacyMigration` flag
- **Validation**: Rejects already-normalized data with clear error messaging
- **Activity Logging**: Records migration events for audit trails

### Components

| Component              | Lines | Description                                      |
| ---------------------- | ----- | ------------------------------------------------ |
| `legacyMigration.ts`   | 464   | Core transformation logic                        |
| `LegacyMigrationPanel` | 325   | React UI for triggering and previewing migration |

### Migration Flow

1. **Read Raw File**: Uses `readRawFileData()` to bypass v2.0 validation
2. **Detect Format**: Identifies legacy v1.x format vs already-normalized data
3. **Preview Statistics**: Shows case/financial/note/alert counts before migration
4. **Apply Migration**: Transforms data and writes to file storage
5. **Notify Success**: Toast feedback and activity log entry

### Gaps / Risks

- Migration is one-way; no rollback mechanism built-in (though backups are created)
- Large datasets (1000+ cases) may have performance considerations
- Limited testing with real-world legacy files (mostly synthetic test data)

### Expansion Opportunities

- Add explicit backup creation before migration
- Support batch migration for multiple files
- Provide detailed migration report with any skipped/failed items
- Add dry-run mode that shows exact changes without applying

### Coverage & Telemetry

- Core transformation logic tested via unit tests
- UI component integration tested through Settings panel
- No dedicated telemetry yet; migration events logged to activity log

### Owners / Notes

Core development team. Utility designed for existing users upgrading from v1.x; may be removed once migration window closes.

---

## Configurable Completion Statuses

### Implementation Snapshot

**Rating: 78/100** _(Added November 26, 2025)_

Dashboard metrics (Cases Processed/Day, Avg. Case Processing Time) now use user-configurable completion statuses instead of hardcoded values. Users can mark which statuses count as "completed" via checkboxes in the Category Manager.

### Strengths

- **User Control**: Each status has a "Completed" checkbox in Category Manager settings
- **Net Change Tracking**: Dashboard counts correctly increment/decrement as cases move to/from completion statuses
- **Backward Compatible**: Legacy statuses (approved, denied, closed, spenddown) auto-marked as completed during migration
- **Type-Safe**: `StatusConfig.countsAsCompleted` field with helper `getCompletionStatusNames()`
- **Dashboard Integration**: Both `CasesProcessedPerDayWidget` and `AvgCaseProcessingTimeWidget` use category config

### Architecture Changes

| File                          | Change                                                |
| ----------------------------- | ----------------------------------------------------- |
| `types/categoryConfig.ts`     | Added `countsAsCompleted?: boolean` to StatusConfig   |
| `CategoryManagerPanel.tsx`    | Added checkbox column with tooltip                    |
| `widgetDataProcessors.ts`     | Accepts `completionStatuses` option, net change logic |
| `CasesProcessedPerDayWidget`  | Uses category config for completion statuses          |
| `AvgCaseProcessingTimeWidget` | Uses category config for completion statuses          |

### Gaps / Risks

- New users must manually configure which statuses count as completed
- No visual indication in case list of "completed" status distinction

### Expansion Opportunities

- Add bulk toggle for marking multiple statuses as completed
- Visual indicator in status badges for completion states
- Dashboard tooltip explaining what counts as "completed"

### Coverage & Telemetry

- Widget processor tests cover net change tracking behavior
- Integration tested through dashboard widget rendering
- 14 new tests added for completion status functionality

### Owners / Notes

Dashboard insights team. Feature enables accurate workflow metrics without hardcoded assumptions.
