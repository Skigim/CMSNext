# CMSNext Actionable Roadmap

> Outcome-focused plan derived from the feature catalogue. Updated at the start of each milestone planning cycle or when priorities shift.

## Guiding Principles

- Ship improvements that strengthen the local-first promise before adding new surface area.
- Complete shadcn/ui migration in small, testable slices to avoid long-running branches.
- Pair every feature investment with tests, telemetry, or documentation recovery so the platform stays observable.
- Keep performance and accessibility baselines green; no initiative closes without measuring its impact.

---

## Near-Term Focus (Next 30 Days)

1. **Finalize shadcn migration for legacy components**
   - Scope: Convert remaining bespoke modals and list views to shadcn primitives; delete duplicate styling layers.
   - Actions: Track progress in `feature-catalogue.md`; add Storybook-lite fixture coverage or RTL smoke tests for each conversion.
   - Dependencies: Inventory of outstanding components from design systems pod; ensure Tailwind tokens cover new patterns.

2. **Telemetry + Health Signals groundwork**
   - Scope: Capture autosave health, import/export frequency, and dashboard load timings using existing logging hooks.
   - Actions: Extend `useFileDataSync` instrumentation, write ingestion stub, document manual collection flow.
   - Dependencies: Dev tooling squad for bundling strategy and opt-in storage considerations.

3. **Accessibility gate for top workflows**
   - Scope: Automate axe checks against case management, financial flows, and notes screens.
   - Actions: Integrate axe-core with RTL suites; document remediation process.
   - Dependencies: Updated testing guidance in `docs/development/testing-infrastructure.md`.

---

## Mid-Term Focus (30–90 Days)

1. **Dashboard insights upgrade**
   - Outcome: Personalized widgets with freshness indicators, leveraging telemetry groundwork.
   - Key Tasks: Build widget registry, add freshness timestamps, prototype trend widget fed by usage metrics.
   - Risks: Bundle growth; mitigate with lazy imports and perf baseline updates.

2. **Financial operations enhancements**
   - Outcome: Per-item changelog and verification workflows that satisfy compliance.
   - Key Tasks: Design changelog schema, surface history in UI, expand validation to cover negative-balance alerts.
   - Risks: Storage churn; monitor autosave timing via new telemetry before rollout.

3. **Data portability improvements**
   - Outcome: Human-friendly import error remediation and optional anonymized exports.
   - Key Tasks: Extend validation messaging, add anonymization CLI flag, update docs and seed scripts.
   - Risks: User education; require documentation update sign-off before release.

---

## Long-Term Bets (90+ Days)

- **Usage metrics service** — graduate telemetry groundwork into a lightweight, opt-in analytics layer.
- **Collaborative note threads** — introduce conversation threads and mentions once storage scaling profile is validated.
- **Release automation** — ship signed bundles with reproducible build metadata tied into deployment guide.
- **Progressive compatibility mode** — investigate read-only experience for browsers without File System Access API.

---

## Operating Cadence

- Review roadmap items against `feature-catalogue.md` at the start of each sprint; prune orphaned tasks.
- Maintain checklist of telemetry, testing, and documentation updates on every feature PR.
- Retrospect initiatives monthly: capture wins, gaps, and follow-on work in the catalogue.
- When priorities shift, update both this roadmap and the catalogue in the same change set to preserve traceability.
