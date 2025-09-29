# Alerts System UI Plan

_Last updated: 2025-09-29_

## 1. Objectives

- Introduce a dedicated alerts experience that feels consistent with the forthcoming "4X-inspired" interface.
- Surface alert state at three levels of context:
  1. **Global awareness** (dashboard + reminder tray).
  2. **List scanning** (case list/table cards).
  3. **Focused work** (case detail drawer with resolution flow).
- Keep the first implementation lightweight and incrementally shippable while laying groundwork for richer overlays and the future action wheel.

## 2. Data & Integration Notes

- Alerts arrive via CSV import and resolve through notes.
- We will store parsed alerts directly on each `CaseDisplay` via a new `alerts: AlertRecord[]` property (defined in `types/case.ts`).
- Resolution automatically appends a note and updates the alert status (e.g. `open → resolved`).
- Activity logging hooks (once implemented) should be triggered from the alert resolution flow.

## 3. Primary UI Surfaces

| Surface | Purpose | Key Elements |
|---------|---------|--------------|
| **Dashboard Tile** | High-level status + quick entry | "Alerts" tile showing counts by severity, quick link to import, optional shortcut to unresolved filter |
| **Reminder Tray** | Ambient, persistent nudge | Stack of top 3 alerts (highest severity / oldest), dismissible quick actions |
| **Case List (table + grid)** | Fast triage across many cases | Alerts badge column (sortable), severity glyphs, tooltip preview, row-level actions |
| **Case Card/Grid tiles** | Visual parity with table view | Corner badge showing count/severity colour band |
| **Case Details header** | Immediate context when viewing a case | Inline alerts summary pill + "View alerts" button launching drawer |
| **Alerts Drawer** | Deep work surface | Tabs for Open / Resolved, detail cards, "Resolve via note" CTA, history snippet |
| **Resolve Modal** | Quick confirm + note creation | Prefilled templated note, severity toggle, optional attachments placeholder |

### Layout Inspirations From the Reference Screenshot

- **Action Wheel**: reserve bottom-right space for a circular quick action menu. Initial spokes: "Import Alerts", "New Note", "Resolve All", "Open Logger".
- **Reminders Panel**: right-side collapsible tray mirroring the screenshot's checklist. Each reminder connects to the alerts drawer filtered to that item.
- **Map Overlay**: treat the case list (table or grid) as the "map"; overlays (alerts drawer, filters) slide in from edges without replacing context.

## 4. Component Inventory

| Component | Type | Responsibilities |
|-----------|------|------------------|
| `AlertBadge` | Presentational | Displays count + highest severity, shared between list/table/card headers |
| `AlertsColumnHeader` | Presentational | Sort toggle + tooltip description for the table view |
| `AlertsDrawer` | Stateful | Fetches alerts for selected case, handles resolve / reopen actions, shows audit timeline |
| `AlertCard` | Presentational | Shows alert metadata, quick actions (resolve, view source note) |
| `ResolveAlertForm` | Stateful | Wraps note creation flow, prepopulates note content, handles toast + autosave notifications |
| `AlertsImportModal` | Stateful | Accepts CSV, surfaces parse warnings, shows matching summary before commit |
| `DashboardAlertsTile` | Presentational | Displays counts + trends, CTA for import and filter |
| `ReminderTray` (future) | Stateful | Aggregates top reminders (alerts + tasks) and drives overlays |

## 5. UX Flow Sketches

### 5.1 Case List Table View (first pass)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Case Name     | MCN      | Status   | Alerts ⚠︎ | Updated     | Actions     │
├───────────────┼──────────┼──────────┼───────────┼─────────────┼─────────────┤
│ Alice Carter  | MCN-4421 | Active   | ●●○ (2)   | 2h ago      | View • Edit │
│ Brandon Singh | MCN-1098 | Pending  | ○○○ (0)   | 1d ago      | View • Edit │
│ Dana Wells    | MCN-5540 | Active   | ●○○ (1)   | 3d ago      | View • Edit │
└───────────────┴──────────┴──────────┴───────────┴─────────────┴─────────────┘
```
- `●` = red (critical), `▲`/`◆` icons optional for unique alert types.
- Column header toggles sort by severity count then date.
- Hover or focus reveals tooltip summarizing alert types.

### 5.2 Alerts Drawer (inline with case details)

```
┌────────────────────────────────────────────┐
│ Case: Alice Carter        [Import Alerts] │
│ Alerts (Open 2 · Resolved 5)              │
│ ┌───────────────────────────────────────┐ │
│ │ High | Medicaid Recert due 09/30      │ │
│ │      "Schedule interview"             │ │
│ │      [Resolve via Note] [Reassign]    │ │
│ └───────────────────────────────────────┘ │
│ ┌───────────────────────────────────────┐ │
│ │ Medium | Income mismatch (DSHS feed)  │ │
│ │      "Verify with employer"          │ │
│ │      [Resolve via Note] [Snooze]      │ │
│ └───────────────────────────────────────┘ │
│ [View Resolved History ▸]                │
└────────────────────────────────────────────┘
```
- Drawer width ~420px, slides from right.
- Global quick actions (Import, Filter) remain visible at top.

### 5.3 Dashboard Alerts Tile

```
┌───────────────────────────────┐
│ 🔔 Alerts                     │
│   Critical: 3 (▲2)           │
│   Moderate: 8 (▲1)           │
│   Low: 12 (▼4)               │
│ [Open Alerts View] [Import]  │
└───────────────────────────────┘
```
- Show sparkline or delta arrows once metrics pipeline is ready.

## 6. Implementation Phasing

### Phase A – Table & Case Details Integration (MVP)
- Add `alerts` column to `CaseTable` + inline badge in `CaseCard` grid view.
- Extend `CaseDetails` header with an alerts summary button opening a simple drawer listing open alerts.
- Provide "Resolve via note" button that routes to existing note modal with prefilled data.

### Phase B – Alerts Drawer Enhancements
- Introduce filters (severity, type).
- Add quick actions (resolve, snooze, jump to note).
- Persist drawer open state in `useCaseListPreferences`.

### Phase C – Dashboard & Reminder Layer
- Replace placeholder dashboard card with Alerts tile.
- Add first version of reminder tray showing top alerts.
- Introduce an import CTA accessible from both dashboard and drawer.

### Phase D – Action Wheel & Advanced Visuals
- Implement bottom-right radial menu for quick actions (feature-flagged initially).
- Apply thematic gradients and micro-animations (matching 4X aesthetic).

## 7. Technical Tasks Snapshot (Phase A)

- [ ] Extend `types/case.ts` with `AlertRecord` interface and add to `CaseDisplay`.
- [ ] Create `components/alerts/AlertBadge.tsx` (shared between list/table/card).
- [ ] Update `CaseTable` column definitions to include alerts (sortable).
- [ ] Update `CaseCard` to show badge.
- [ ] Add `CaseAlertsDrawer.tsx` mounted from `CaseDetails` (basic list).
- [ ] Wire resolve button to existing note flow (new helper `createAlertResolutionNote`).
- [ ] Surface toasts via `clickToCopy` pattern for alert IDs if needed.

## 8. Mock Data & Storybook (Optional Enhancers)

- Create `__mocks__/alerts.ts` with sample alert objects for UI testing.
- Add Storybook stories (if/when Storybook is introduced) for `AlertBadge`, drawer states, and dashboard tile.

## 9. Risks & Open Questions

- **Matching Confidence**: Should unresolved matches (CSV row with no case) be displayed in UI? (Proposed: yes, within import modal as "unmatched" section.)
- **Severity Taxonomy**: Need confirmed mapping (Critical / High / Medium / Low) and color tokens.
- **Snooze Workflow**: Not part of MVP but should have placeholder hook.
- **Accessibility**: Ensure badges and drawer controls are keyboard-navigable and announce severity.

## 10. Next Steps

1. Finalize alert data schema + severity palette.
2. Kick off Phase A tasks (schema + badge + table integration).
3. Prepare CSV import UI wire (separate doc once data parser is ported).

---

_Assumptions_: Case data already in memory via `DataManager`; alerts array will be hydrated during import or case load. Drawer implementation can rely on existing shadcn/ui `Sheet` component or reuse the resizable panel pattern for consistency.
