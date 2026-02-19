# SonarCloud Issue Snapshot

- Project: Skigim_CMSNext
- Open issues fetched: 206 (at 2026-02-19T21:49:35Z)
- Security hotspots fetched: 37 (at 2026-02-19T21:49:35Z)
- Test-file issues: 2
- Non-test issues: 204

## Open Issues by Type

- CODE_SMELL: 204
- BUG: 2

## Open Issues by Severity

- MINOR: 179
- MAJOR: 24
- CRITICAL: 1
- INFO: 2

## Top 20 Rules (by count)

| Rule               | Count |
| ------------------ | ----: |
| `typescript:S6759` |    68 |
| `typescript:S1874` |    26 |
| `typescript:S7735` |    20 |
| `typescript:S2486` |     9 |
| `typescript:S6754` |     9 |
| `typescript:S7778` |     9 |
| `typescript:S4325` |     6 |
| `typescript:S2310` |     5 |
| `typescript:S6582` |     5 |
| `typescript:S7764` |     5 |
| `typescript:S7785` |     5 |
| `typescript:S6594` |     4 |
| `typescript:S6767` |     4 |
| `typescript:S6819` |     4 |
| `typescript:S7758` |     4 |
| `typescript:S7741` |     3 |
| `typescript:S7763` |     3 |
| `css:S4662`        |     2 |
| `typescript:S1135` |     2 |
| `typescript:S6551` |     2 |

## Top 20 Files (by count)

| File                                                 | Count |
| ---------------------------------------------------- | ----: |
| components/category/CategoryManagerPanel.tsx         |     7 |
| domain/avs/parser.ts                                 |     7 |
| scripts/analyzeNavigationTrace.ts                    |     7 |
| components/financial/useFinancialItemCardState.ts    |     6 |
| domain/dashboard/priorityQueue.ts                    |     6 |
| domain/dashboard/widgets.ts                          |     6 |
| hooks/useCaseListPreferences.ts                      |     6 |
| utils/errorReporting.ts                              |     5 |
| components/common/GlobalContextMenu.tsx              |     4 |
| components/diagnostics/FileStorageSettings.tsx       |     4 |
| scripts/seedCli.ts                                   |     4 |
| utils/services/FileStorageService.ts                 |     4 |
| components/case/CaseColumn.tsx                       |     3 |
| components/case/NotesPopover.tsx                     |     3 |
| components/financial/FinancialItemCardMeta.tsx       |     3 |
| components/modals/PositionAssignmentsReviewModal.tsx |     3 |
| components/settings/SortableSummaryTemplates.tsx     |     3 |
| components/ui/breadcrumb.tsx                         |     3 |
| contexts/SelectedMonthContext.tsx                    |     3 |
| scripts/usageReport.ts                               |     3 |

## Hotspots by Status

- REVIEWED: 37

## Suggested Remediation Waves

1. High-volume rule sweeps: tackle top 3-5 rules across top files first.
2. Critical/Major non-test issues: prioritize by severity in production code paths.
3. Remaining test-file issues: batch-fix by rule family to reduce churn.
4. Hotspots review: confirm each REVIEWED hotspot disposition and close follow-up work.
5. Re-run tests/build and refresh SonarCloud scan after each wave.
