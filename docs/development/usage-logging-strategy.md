# CMSNext Usage Logging Strategy

## Objectives
- Identify seldom-used routes, components, and flows to guide cleanup or enhancement work.
- Respect the filesystem-only architecture by persisting metrics locally via the File System Access API.
- Maintain user privacy: usage data never leaves the customer machine and can be cleared on demand.

## Guiding Principles
1. **Filesystem-first telemetry** – usage metrics use the existing `fileDataProvider.getAPI()` to read/write data inside the workspace folder (e.g., `usage-metrics.json`).
2. **Opt-in visibility** – expose a simple toggle in diagnostics settings so operators can enable/disable logging and clear history.
3. **Structured events** – record composable event payloads (`componentId`, `action`, `metadata`, `timestamp`) so they can be aggregated without schema churn.
4. **Debounced persistence** – buffer in-memory tallies and persist via `AutosaveFileService` batching to avoid blocking UI interactions.

## Event Sources
| Area | Hook-in Point | Example Event |
|------|---------------|---------------|
| Navigation | `useNavigationFlow` (route change effect) | `{ componentId: "route.dashboard", action: "enter" }` |
| Panels & modals | Component-level `useEffect` on mount/unmount | `{ componentId: "modal.caseDetails", action: "open" }` |
| Feature actions | Existing callbacks (e.g., `handleAddNote`) | `{ componentId: "noteFlow", action: "create", metadata: { category: note.category } }` |
| Export flows | Activity report exporter | `{ componentId: "activityExport.txt", action: "export" }` |

## Persistence Model
```ts
interface UsageEvent {
  id: string; // uuid
  componentId: string;
  action: 'view' | 'enter' | 'open' | 'submit' | 'export' | 'custom';
  metadata?: Record<string, string | number | boolean>;
  timestamp: string; // ISO-8601
}

interface UsageSnapshot {
  generatedAt: string;
  totals: Record<string, number>; // componentId => count
  events: UsageEvent[]; // optional, rolling buffer capped at N entries
}
```
- Store snapshots under `usage/usage-metrics.json` alongside other autosaved data.
- Keep the rolling `events` array capped (e.g., last 250 entries) to limit file size, while `totals` provides long-term counts.

## Implementation Steps
1. **Create a UsageMetrics service**
   - New module `utils/UsageMetricsService.ts` exposing `recordEvent`, `getSnapshot`, `reset`.
   - Internally acquire the filesystem API via `fileDataProvider.getAPI()` and persist using the existing autosave debounce (`safeNotifyFileStorageChange`).
   - Maintain an in-memory tally map for the current session before persisting.
2. **Wire a context provider**
   - Add `UsageMetricsContext` with `recordComponentEvent` helper and `isLoggingEnabled` state.
   - Wrap `AppProviders` so downstream components can opt-in easily.
3. **Instrument high-value flows**
   - Navigation: call `recordComponentEvent('route.dashboard', 'enter')` inside `useNavigationFlow`.
   - Dashboard cards/modals: on mount or button actions, log with stable IDs (e.g., `dashboard.recentCases`).
   - Exports & utilities: log completions inside existing service callbacks.
4. **Expose diagnostics UI**
   - Extend the diagnostics/settings panel with toggles:
     - Enable/disable usage logging (persists to local preference).
     - Button to clear usage metrics via `UsageMetricsService.reset()`.
   - Display basic counts per component for quick reference.
5. **Batch and archive**
   - Use `startBatchMode()` when recording multiple events in quick succession (e.g., import flows).
   - Optionally create a `scripts/exportUsageMetrics.ts` for operators to dump snapshot CSVs.

## Maintenance & Analysis
- Automate a nightly (or session-end) compaction that snapshots totals and truncates old events.
- Add Vitest coverage for the service (load/save/reset) and a simple integration test that toggles logging and records at least one event.
- Document component IDs in `docs/development/usage-component-map.md` to keep naming consistent as new features land.

## Future Enhancements
- Correlate usage data with autosave state (e.g., "feature skipped because storage unavailable").
- Visualize trends inside the diagnostics screen with lightweight charts (no external networking required).
- Provide CLI tooling (`npm run usage:report`) to produce usage summaries for stakeholders without opening the UI.
