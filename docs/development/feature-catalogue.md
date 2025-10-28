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

**Rating: 79/100**

Core case workflows (create, view, edit, delete) are stable through `useCaseManagement`, `useNavigationFlow`, and DataManager-backed persistence. Case forms leverage strict TypeScript models and validation utilities, while breadcrumbs and view model helpers keep navigation coherent across dashboard, details, and workspace views.

### Strengths

- Full CRUD for person + case record backed by normalized data models (`CaseDisplay`, `CaseRecord`, `Person`)
- Navigation/selection state centralized via `useNavigationFlow`, ensuring consistent transitions and measurement logging
- Case forms and detail panels reuse shared components with validation, masking, and autosave integration
- Activity log and notes feed seamlessly into case detail views, providing contextual history
- Bulk actions (archive/import) supported through DataManager utilities, with safeguards like backups and validation

### Gaps / Risks

- No dedicated end-to-end regression test for multi-user scenarios or simultaneous edits (risk of stale state when multiple tabs open)
- Case list filtering/search UX could expose more advanced predicates (status + priority combos)—currently basic
- Some legacy modals still tied to larger orchestrator components, complicating future decomposition
- Accessibility audits for complex forms are ad hoc; no automated tooling verifying tab order or ARIA coverage

### Expansion Opportunities

- Introduce saved views/smart filters for quickly surfacing priority or aging cases
- Add draft state or change history snapshots for compliance-driven workflows
- Explore in-app guidance/onboarding checklists to reduce new-user friction
- Continue decomposing `AppContent` flows into domain-specific providers/hooks to simplify maintenance

### Coverage & Telemetry

- Hook suites: `useNavigationFlow.test.ts` exercises view transitions; `useCaseManagement` helpers covered indirectly through integration tests
- RTL suites for CaseForm, CaseDetails, and related modals ensure validation and rendering behavior
- Integration test (`integration/connectionFlow.test.tsx`) covers connect → load → edit → save loop
- Pending: telemetry from upcoming interaction trace to quantify case-view latency and identify hotspots

### Owners / Notes

Driven by the core product workflows squad; align upcoming work with Phase 4 refactor follow-ups. Coordinate updates with UX when introducing new filters or onboarding flows.

---

## Financial Operations Suite

### Implementation Snapshot

**Rating: 73/100**

Financial modules (resources, income, expenses) leverage dedicated components and hooks (`useFinancialItemFlow`, `FinancialItemCard`) with inline editing, validation, and autosave integration. Verification metadata and frequency handling cover core program requirements, while normalized data structures ensure consistent reporting.

### Strengths

- Clear separation of financial categories with configurable definitions in `categoryConfig`
- Inline editing via `FinancialItemCard` keeps UX fast; state managed by `useFinancialItemCardState`
- Verification status badges (VR/AVS/etc.) surface compliance at a glance
- Validation rules enforce numeric integrity, frequency selections, and required metadata
- Financial summaries feed into dashboard widgets and case detail totals

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

**Rating: 79/100** _(Updated October 27, 2025)_

Tooling stack (Vitest, ESLint 9 flat config, Tailwind v4 pipeline) covers day-to-day development with scripted performance baselines, seed data generators, and comprehensive architecture documentation. Phase 1 & Phase 2 refactor completions established domain-driven patterns with event bus infrastructure. Dev container + npm workflows yield repeatable environments, but release automation and telemetry collection remain largely manual.

### Strengths

- **Comprehensive test harness**: 290 tests passing across unit, RTL, integration, and performance scripts with coverage reporting
- **Architecture foundations**: Domain-driven structure with rich entities, repository pattern, and event-driven state management
- **Phase 1 deliverables**: Unified StorageRepository, ApplicationState singleton, CreateCase use case with optimistic update + rollback
- **Phase 2 deliverables**: DomainEventBus, ActivityLogger with persistence rollback, UpdateCase/DeleteCase use cases, rich domain entities for all aggregates
- **Enhanced testing patterns**: `toSnapshot()` and `sortSnapshots()` helpers improve test reliability; comprehensive integration coverage
- **Dev container** and documented setup enable consistent onboarding across platforms
- **CLI utilities** (`scripts/`) generate sample data, run performance baselines, and capture usage reports
- **Linting/formatting** standardized via ESLint 9 + Prettier; zero warning baseline maintained
- **Documentation set** (Testing Infrastructure, Performance Metrics, Phase Completion Summaries, Architecture Refactor Plan) keeps teams aligned

### Gaps / Risks

- No automated release packaging or signed build pipeline—manual steps required for distribution
- Usage telemetry service still conceptual; no automated collection of feature adoption
- Accessibility and visual regression tooling not part of CI, risking regressions
- Dev container updates rely on manual refresh; dependency drift can surprise contributors
- Operational runbooks (backups, release checklists) live in docs but lack executable automation
- Phase 3 (Hooks Migration) not yet started—React components still use legacy patterns

### Expansion Opportunities

- **Phase 3: Hooks Migration** - Migrate React hooks to use ApplicationState and domain events (November 1-15, 2025)
- Introduce lightweight release automation (tagged builds, checksum artifacts)
- Stand up usage metrics service to feed feature roadmap and dashboard insights
- Add automated accessibility/visual regression checks to CI
- Provide quickstart scripts for common contributor workflows (test subsets, perf baselines)
- Automate dev container maintenance to flag outdated dependencies before they drift

### Coverage & Telemetry

- **Vitest suites**: 290 tests across major domains; coverage reports stored in `coverage/` and referenced in docs
- **New test coverage**: +79 tests in Phase 2 covering domain entities, use cases, ApplicationState, StorageRepository, DomainEventBus, ActivityLogger
- **Performance telemetry**: Partially automated (`perf:baseline`, bundle analysis); manual traces pending
- **Architecture documentation**: Phase 1 & 2 completion summaries, state management strategy, Phase 3 planning
- No centralized telemetry ingestion yet—future work to log usage, autosave health, and import metrics
- Dev tooling health tracked via docs but lacks automated status dashboard

### Owners / Notes

Platform enablement group coordinates tooling, CI, and documentation upkeep. Architecture refactor squad owns domain structure, event bus, and use case patterns. Prioritize Phase 3 hooks migration (November 2025) to complete event-driven transition.

---

## Feature Flags

### Implementation Snapshot

**Rating: 65/100**

Feature flag infrastructure now lives in `utils/featureFlags.ts` with immutable defaults and helper utilities. `ApplicationState` exposes flag state, and `useAppState` streams updates into React so components (like dashboard widgets) can opt-in through metadata instead of ad-hoc conditionals. The system enables gradual rollout for dashboard insights and future refactor milestones.

### Strengths

- Type-safe `FeatureFlagKey` union removes magic strings from the codebase
- `DEFAULT_FLAGS` and `createFeatureFlagContext` yield reproducible flag contexts for tests and runtime overrides
- Runtime toggling flows through `useAppState().setFeatureFlags`, keeping React components synchronized via subscriptions
- Widget registry honours `metadata.featureFlag`, making new widget flags a metadata-only change
- New documentation (`feature-flags-guide.md`) keeps usage patterns searchable for contributors

### Gaps / Risks

- Flags are in-memory only; there is no persisted storage for overrides across sessions yet
- No diagnostic UI exists for QA or product to toggle flags during reviews
- Observability is limited—flag enable/disable events are not tracked in telemetry
- Naming convention relies on convention rather than automation or linting

### Expansion Opportunities

- Persist overrides via ApplicationState hydration/persist flows so flags survive reloads
- Build a lightweight developer toolbar to inspect and toggle flags at runtime
- Emit telemetry when flags change to measure adoption and schedule cleanup
- Add lint rule or generator script to enforce naming/documentation of new flags

### Coverage & Telemetry

- Unit tests (`__tests__/utils/featureFlags.test.ts`) validate defaults, overrides, and helper utilities
- `ApplicationState` tests verify mutable operations notify subscribers exactly once per change
- Integration suite (`__tests__/integration/featureFlagFlow.test.tsx`) ensures dashboard widgets respond to toggles and runtime updates
- Telemetry capture is planned but not yet implemented; no metrics currently collected

### Owners / Notes

Insights platform and architecture refactor squads co-own the flag catalogue. Update `feature-flags-guide.md` whenever new flags ship, and coordinate cleanup once features graduate from guarded rollout.
