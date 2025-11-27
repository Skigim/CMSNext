# CMSNext Feature Catalogue

> Living index of marketable features, their current implementation status, quality, and future investments.

## How to Use This Document

- **Implementation Snapshot** — Update whenever new functionality lands
- **Strengths** — Capture wins to celebrate and reuse patterns
- **Gaps / Risks** — Log known limitations so they can be triaged or scheduled
- **Expansion Opportunities** — Propose next steps and link them to tickets once planned
- **Coverage & Telemetry** — Track automated coverage and observability

✍️ _Add dates and owners when significant updates occur to maintain historical context._

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

**Rating: 88/100** _(Updated November 20, 2025)_

Core case workflows (create, view, edit, delete) are production-ready through the refactored service architecture. CaseService handles all case CRUD operations with status tracking, import/export, and activity log integration. The hook layer (`useCaseManagement`) provides a clean facade over DataManager with optimistic updates and comprehensive test coverage.

### Strengths

- **Service Layer Architecture**: `CaseService` (432 lines) encapsulates all case business logic with clean separation of concerns
- **DataManager Orchestration**: Thin coordination layer delegates to specialized services via dependency injection
- **Streamlined Hook Layer**: `useCaseManagement` provides clean React integration with toast feedback and error handling
- **Navigation Integration**: `useNavigationFlow` ensures consistent transitions and performance measurement logging across views
- **Comprehensive Test Coverage**: 244/244 tests passing (100%) including service tests, integration tests, and component tests
- **Data Model Integrity**: Normalized structures (`CaseDisplay`, `CaseRecord`, `Person`) with strict TypeScript validation
- **Import/Export**: Bulk operations with duplicate detection and progress indicators
- **Autosave Integration**: Forms seamlessly integrate with AutosaveFileService for reliable persistence
- **Configurable Completion Statuses**: Users define which statuses count as "completed" for dashboard metrics

### Gaps / Risks

- Case list filtering/search UX exposes basic predicates; advanced combos (status + priority + date range) exist but could benefit from saved filter presets
- Accessibility audits for complex forms remain ad hoc; automated tooling for tab order and ARIA coverage would strengthen compliance
- Performance benchmarks for large datasets (1k+ cases) not yet established; virtualization applied but not stress-tested

### Expansion Opportunities

- **Saved Filter Views**: Introduce user-configurable filter presets for quickly surfacing priority cases, aging items, or custom criteria
- **Draft State & Change History**: Add draft persistence and snapshots for compliance-driven workflows requiring audit trails
- **Performance Optimization**: Establish 1k+ case benchmark suite and optimize rendering/filtering for large datasets
- **Guided Onboarding**: Develop in-app checklists or contextual guidance to reduce new-user friction

### Coverage & Telemetry

- **Service Layer**: CaseService fully tested with 100% coverage for CRUD operations, import/export, and activity logging
- **Hook Layer**: `useCaseManagement.test.tsx` verifies hook facade, `useNavigationFlow.test.ts` exercises view transitions
- **Component Layer**: RTL suites for `CaseWorkspace`, `CaseList`, `CaseStatusBadge`, and form components ensure rendering and interaction correctness
- **Integration**: Autosave status integration test validates end-to-end persistence with FileStorage context
- **Test Suite Status**: 244 tests passing across 40 test files (100%) as of November 26, 2025
- **Performance**: Telemetry infrastructure ready for interaction traces; baseline measurements pending for case-view latency under load

### Owners / Notes

Phase 3 Cases domain refactor completed November 2, 2025. Architecture now serves as reference pattern for future enhancements. Coordinate with product workflows squad for feature expansion; align telemetry captures with Phase 4 manual tasks.

---

## Financial Operations Suite

### Implementation Snapshot

**Rating: 73/100** _(Next for Phase 3 Architecture Migration)_

Financial modules (resources, income, expenses) leverage dedicated components and hooks (`useFinancialItemFlow`, `FinancialItemCard`) with inline editing, validation, and autosave integration. Verification metadata and frequency handling cover core program requirements, while normalized data structures ensure consistent reporting.

### Strengths

- **Service Architecture**: FinancialsService (235 lines) handles all financial CRUD operations with category-based management
- **Clean Hook Layer**: `useFinancialItemFlow` provides React integration with toast feedback and optimistic updates
- **Inline Editing**: `FinancialItemCard` keeps UX fast with state managed by `useFinancialItemCardState`
- **Category Separation**: Clear separation of resources, income, and expenses with configurable definitions in `categoryConfig`
- **Verification Status**: Badges (VR/AVS/etc.) surface compliance at a glance
- **Validation Rules**: Enforce numeric integrity, frequency selections, and required metadata
- **Dashboard Integration**: Financial summaries feed into dashboard widgets and case detail totals

### Gaps / Risks

- Budget rollups and scenario planning (what-if calculations) not yet implemented
- No audit trail for financial changes; edit history limited to global notes
- Table/list UX can be heavy on large datasets; virtualization only partially applied
- Import/export validation focuses on structural correctness—business rule validation (e.g., negative balances) is manual

### Expansion Opportunities

- Introduce changelog per financial item with user/time metadata to support historical tracking
- Enhance bulk edit capabilities (e.g., mark multiple expenses verified)
- Surface contextual insights within a case (e.g., category breakdown, verification deadlines) while avoiding cross-case aggregation
- Explore contextual guidance or checklists to ensure verification tasks stay compliant

### Coverage & Telemetry

- RTL suites target FinancialItemCard, case financial forms, and verification flows
- `useFinancialItemFlow` tested through component behavior; additional direct hook tests could increase confidence
- No dedicated telemetry yet—future perf traces should include financial tab interactions
- Synthetic bundle analysis shows financial utilities in `utils-CBw3aSZY.js`; monitoring ensures chunk strategy remains effective

### Owners / Notes

Primary ownership with the financial workflows pod; coordinate future enhancements with compliance stakeholders to ensure verification rules meet program standards.

---

## Notes & Collaboration Aids

### Implementation Snapshot

**Rating: 71/100**

Notes system supports categorized, timestamped entries tied to cases with edit history and toast feedback. Activity log integration keeps audit context nearby, and quick-add UX leverages keyboard shortcuts and autosave-friendly forms.

### Strengths

- Multiple categories (General, VR Update, Client Contact, Follow-up) with filtering in case detail views
- Notes tied to case timeline with timestamps, author context, and inline editing
- Sonner toasts provide immediate feedback on create/update/delete actions
- Keyboard shortcuts and focused forms streamline fast note capture
- Activity log complements notes by recording system-driven events (imports, autosave results)

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

### Coverage & Telemetry

- RTL suites cover notes components and ensure category filtering works; integration tests verify connection flow includes note creation
- Activity log utilities tested via `useCaseActivityLog` hook coverage
- No telemetry yet for note creation rate or latency; candidate for future usage metrics service

### Owners / Notes

Collaboration feature group; capture planned enhancements in updated documentation and coordinate with security/privacy when considering attachments.

---

## Intelligent Dashboard & Insights

### Implementation Snapshot

**Rating: 70/100**

Dashboard now features a production-ready widget registry framework with lazy loading, automatic error handling, and data freshness tracking. Initial widgets (Case Priority, Activity Timeline) provide real-time insights. Core metrics (case counts, autosave badge) remain visible, and architecture scales for future analytics expansion.

### Strengths

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

**Rating: 76/100**

JSON import/export flows are stable with schema validation, autosave-aware backups, and legacy migration helpers (`dataNormalization`, `convertLegacyCaseData`). CLI scripts generate seed data and examples, supporting offline onboarding.

### Strengths

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

**Rating: 82/100**

Six-theme system (Light, Dark, Soft Dark, Warm, Blue, Paper) built on shadcn/ui delivers polished, responsive layouts. Tailwind CSS v4 tokens and component decomposition keep styling consistent, while accessibility patterns are in place though not exhaustively audited.

### Strengths

- Theme switcher integrates with ThemeContext; transitions smooth without layout shift
- UI built on shadcn primitives ensures accessible defaults and consistent patterns
- Responsive design tested across desktop/tablet/mobile breakpoints
- Sonner toasts and Lucide iconography tie together interactions with modern feedback
- Component library decomposition (e.g., FinancialItemCard subcomponents) encourages reuse and maintainability

### Gaps / Risks

- Accessibility testing relies on manual reviews; automated tooling (axe, pa11y) not yet wired into CI
- Some legacy components still mix custom and shadcn styles, risking drift
- Theme contrast ratios need formal verification to meet WCAG AA across all palettes
- Limited motion design guidelines; micro-interactions vary between features

### Expansion Opportunities

- Introduce automated accessibility checks in CI and document remediation workflows
- Complete migration of remaining bespoke components to shadcn standards
- Publish UI style guide including motion, spacing, and tone guidelines for contributors
- Explore theme presets for organization branding while preserving accessibility guarantees

### Coverage & Telemetry

- Storybook-equivalent not in place; rely on RTL component tests (CaseForm, ConnectToExistingModal) for regression coverage
- No UI performance telemetry; manual baseline captured via bundle analysis
- Accessibility documentation partially covered in `PROJECT_STRUCTURE.md`; needs refresh
- Consider adding visual regression testing once component count stabilizes

### Owners / Notes

Design systems + front-end platform pairing. Produce contributor-facing UI guidelines and accessibility checklists alongside upcoming documentation refresh.

---

## Developer & Operations Enablement

### Implementation Snapshot

**Rating: 79/100** _(Updated November 20, 2025)_

Tooling stack (Vitest, ESLint 9 flat config, Tailwind v4 pipeline) covers day-to-day development with scripted performance baselines, seed data generators, and comprehensive architecture documentation. Service extraction (Phase 1) established clean DataManager + Services pattern with dependency injection. Dev container + npm workflows yield repeatable environments, but release automation and telemetry collection remain largely manual.

### Strengths

- **Comprehensive test harness**: 310 tests passing across unit, RTL, integration, and performance scripts with coverage reporting
- **Service Architecture**: DataManager + 7 focused services (FileStorageService, AlertsService, CaseService, NotesService, FinancialsService, ActivityLogService, CategoryConfigService)
- **Dependency Injection**: Clean service composition with focused responsibilities
- **Storage Normalization**: v2.0 normalized format with automatic migration from legacy formats
- **Enhanced testing patterns**: `toSnapshot()` and `sortSnapshots()` helpers improve test reliability; comprehensive integration coverage
- **Dev container** and documented setup enable consistent onboarding across platforms
- **CLI utilities** (`scripts/`) generate sample data, run performance baselines, and capture usage reports
- **Linting/formatting** standardized via ESLint 9 + Prettier; zero warning baseline maintained
- **Documentation set** (Testing Infrastructure, Performance Metrics, Service Extraction summaries) keeps teams aligned

### Gaps / Risks

- No automated release packaging or signed build pipeline—manual steps required for distribution
- Usage telemetry service still conceptual; no automated collection of feature adoption
- Accessibility and visual regression tooling not part of CI, risking regressions
- Dev container updates rely on manual refresh; dependency drift can surprise contributors
- Operational runbooks (backups, release checklists) live in docs but lack executable automation

### Expansion Opportunities

- Introduce lightweight release automation (tagged builds, checksum artifacts)
- Stand up usage metrics service to feed feature roadmap and dashboard insights
- Add automated accessibility/visual regression checks to CI
- Provide quickstart scripts for common contributor workflows (test subsets, perf baselines)
- Automate dev container maintenance to flag outdated dependencies before they drift

### Coverage & Telemetry

- **Vitest suites**: 230 tests across 40 test files; coverage reports stored in `coverage/` and referenced in docs
- **Service tests**: Complete coverage for all 7 services with unit and integration tests
- **Performance telemetry**: Partially automated (`perf:baseline`, bundle analysis); manual traces pending
- **Architecture documentation**: Service extraction summaries, storage normalization strategy, testing infrastructure
- No centralized telemetry ingestion yet—future work to log usage, autosave health, and import metrics
- Dev tooling health tracked via docs but lacks automated status dashboard

### Owners / Notes

Platform enablement group coordinates tooling, CI, and documentation upkeep. Service architecture maintained by core development team.

---

## Feature Flags

### Implementation Snapshot

**Rating: 72/100** _(Updated November 26, 2025)_

Feature flag infrastructure lives in `utils/featureFlags.ts` with immutable defaults and helper utilities. Flags are managed through `useAppViewState` hook, enabling dashboard widgets to opt-in through metadata instead of ad-hoc conditionals. The system enables gradual rollout for dashboard insights and UI customization.

**Note:** Legacy refactor flags (`USE_FINANCIALS_DOMAIN`, `USE_NEW_ARCHITECTURE`) were removed in November 2025 as the domain layer experiment was concluded and removed.

### Current Flags

| Flag                       | Default | Description                                           |
| -------------------------- | ------- | ----------------------------------------------------- |
| `dashboard.widgets.*`      | `true`  | Controls visibility of individual dashboard widgets   |
| `reports.advancedFilters`  | `false` | Placeholder for advanced reporting filters            |
| `cases.bulkActions`        | `false` | Placeholder for case bulk actions tooling             |
| `settings.devTools`        | `DEV`   | Developer tools in Settings (dev mode only)           |
| `settings.legacyMigration` | `DEV`   | Legacy v1.x to v2.0 migration utility (dev mode only) |

### Strengths

- Type-safe `FeatureFlagKey` union removes magic strings from the codebase
- `DEFAULT_FLAGS` and `createFeatureFlagContext` yield reproducible flag contexts for tests and runtime overrides
- Runtime toggling flows through `useAppViewState().setFeatureFlags`, keeping React components synchronized
- Widget registry honors `metadata.featureFlag`, making new widget flags a metadata-only change
- Dashboard widget toggles enable user customization of their view
- Clean flag set with no legacy cruft after domain layer removal
- `settings.legacyMigration` flag gates migration utility for safe rollout

### Gaps / Risks

- Flags are in-memory only; there is no persisted storage for overrides across sessions yet
- No diagnostic UI exists for QA or product to toggle flags during reviews
- Observability is limited—flag enable/disable events are not tracked in telemetry

### Expansion Opportunities

- Persist flag overrides so they survive page reloads
- Build a lightweight developer toolbar to inspect and toggle flags at runtime
- Emit telemetry when flags change to measure adoption and schedule cleanup

### Coverage & Telemetry

- Unit tests (`__tests__/utils/featureFlags.test.ts`) validate defaults, overrides, and helper utilities
- Integration tests ensure dashboard widgets respond to flag toggles correctly
- Telemetry capture is planned but not yet implemented; no metrics currently collected

### Owners / Notes

Core development team owns the flag system. Coordinate cleanup once features graduate from guarded rollout.

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

| Component              | Lines | Description                                   |
| ---------------------- | ----- | --------------------------------------------- |
| `legacyMigration.ts`   | 464   | Core transformation logic                     |
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

| File                           | Change                                              |
| ------------------------------ | --------------------------------------------------- |
| `types/categoryConfig.ts`      | Added `countsAsCompleted?: boolean` to StatusConfig |
| `CategoryManagerPanel.tsx`     | Added checkbox column with tooltip                  |
| `widgetDataProcessors.ts`      | Accepts `completionStatuses` option, net change logic |
| `CasesProcessedPerDayWidget`   | Uses category config for completion statuses        |
| `AvgCaseProcessingTimeWidget`  | Uses category config for completion statuses        |

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
