# CMSNext Feature Roadmap

> Living document for tracking marketable features, their current implementation status, quality, and future investments.

## How to Use This Document

- **Implementation Snapshot** — Update whenever new functionality lands
- **Strengths** — Capture wins to celebrate and reuse patterns
- **Gaps / Risks** — Log known limitations so they can be triaged or scheduled
- **Expansion Opportunities** — Propose next steps and link them to tickets once planned
- **Coverage & Telemetry** — Track automated coverage and observability

✍️ _Add dates and owners when significant updates occur to maintain historical context._

---

## Scoring Model

| Rating | Maturity Level |
|--------|----------------|
| **0–49** | Foundational capabilities missing or unreliable; feature not marketable yet |
| **50–69** | Core capability present but fragile or incomplete; major gaps limit adoption |
| **70–84** | Solid implementation serving real users with clear, addressable improvements outstanding |
| **85–94** | Advanced, polished experience; remaining work is fine-tuning or long-tail edge cases |
| **95** | Near-ideal. Reserved for exceptional maturity with only incremental gains left. _(We never assign 100.)_ |

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
- Comprehensive documentation in `DeploymentGuide.md`, `file-storage-toast-catalogue.md`, and `enhanced-error-boundary-summary.md`

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
**Rating: 55/100**

Dashboard presents core stats (case counts, priorities, recent activity) with autosave badge awareness, but insights remain mostly static and manually curated. Widget framework is functional yet limited, and instrumentation for data freshness is pending.

### Strengths
- Priority and status tiles highlight urgent cases at a glance
- Recent activity section ties into notes/activity log for quick follow-up
- Autosave status badge embedded in dashboard keeps storage health visible
- Widget layout responsive and aligns with shadcn design baseline
- Architecture supports lazy introduction of new widgets without full page reload

### Gaps / Risks
- Lacks advanced analytics (trend lines, aging reports, workload distribution)
- No customization or saved layouts; dashboard is one-size-fits-all
- Data freshness indicators absent—users can't see when metrics last updated
- Performance impact of additional widgets unproven; profiling not yet captured
- Manual chunks may not isolate dashboard if new widgets import heavy dependencies

### Expansion Opportunities
- Build interactive charts that stay case-focused (e.g., pipeline progression, priority backlog) using lightweight visualization libs
- Allow per-user widget selection or ordering for personalized workflows
- Add data freshness timestamps and quick actions (e.g., jump to filters) for each widget
- Integrate planned usage metrics to surface navigation hotspots or autosave reliability trends without aggregating sensitive financial totals

### Coverage & Telemetry
- Limited RTL coverage presently focuses on presence of key widgets; no deep behavioral tests
- Telemetry for dashboard interactions absent; slated once usage metrics service ships
- Bundle analysis monitors overall dashboard footprint but lacks widget-level granularity
- Upcoming Phase 4 manual trace should measure dashboard render costs to inform optimization

### Owners / Notes
Product insights pod (to be staffed as upcoming planning solidifies). Tie dashboard upgrades to feature launches so metrics reflect new capabilities.

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
**Rating: 72/100**

Tooling stack (Vitest, ESLint 9 flat config, Tailwind v4 pipeline) covers day-to-day development with scripted performance baselines and seed data generators. Dev container + npm workflows yield repeatable environments, but release automation, telemetry, and accessibility enforcement remain largely manual.

### Strengths
- Comprehensive test harness: unit, RTL, integration, and performance scripts with coverage reporting
- Dev container and documented setup enable consistent onboarding across platforms
- CLI utilities (`scripts/`) generate sample data, run performance baselines, and capture usage reports
- Linting/formatting standardized via ESLint 9 + Prettier; zero warning baseline maintained
- Documentation set (Testing Infrastructure, Performance Metrics, Deployment Guide) keeps teams aligned

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
- Vitest suites cover major domains; coverage reports stored in `coverage/` and referenced in docs
- Performance telemetry partially automated (`perf:baseline`, bundle analysis); manual traces pending
- No centralized telemetry ingestion yet—future work to log usage, autosave health, and import metrics
- Dev tooling health tracked via docs but lacks automated status dashboard

### Owners / Notes
Platform enablement group coordinates tooling, CI, and documentation upkeep. Prioritize release automation and telemetry plumbing once Phase 4 manual checks close.
