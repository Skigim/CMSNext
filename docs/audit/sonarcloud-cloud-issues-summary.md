# SonarCloud Issue Snapshot

- Project: Skigim_CMSNext
- Open issues fetched: 614 (at 2026-02-13T17:31:51Z)
- Security hotspots fetched: 37 (at 2026-02-13T17:32:21Z)
- Test-file issues: 25
- Non-test issues: 589

## Open Issues by Type

- CODE_SMELL: 612
- BUG: 2

## Open Issues by Severity

- MINOR: 473
- MAJOR: 130
- CRITICAL: 9
- INFO: 2

## Top 20 Rules (by count)

| Rule               | Count |
| ------------------ | ----: |
| `typescript:S6759` |   118 |
| `typescript:S7778` |   116 |
| `typescript:S7735` |    36 |
| `typescript:S1874` |    30 |
| `typescript:S3358` |    29 |
| `typescript:S7773` |    29 |
| `typescript:S7772` |    26 |
| `typescript:S6819` |    17 |
| `typescript:S7781` |    17 |
| `typescript:S4325` |    15 |
| `typescript:S6479` |    15 |
| `typescript:S3863` |    14 |
| `typescript:S2486` |    11 |
| `typescript:S6582` |    11 |
| `typescript:S7764` |    11 |
| `typescript:S2933` |     9 |
| `typescript:S6754` |     9 |
| `typescript:S7785` |     9 |
| `typescript:S6481` |     6 |
| `typescript:S7762` |     6 |

## Top 20 Files (by count)

| File                                                   | Count |
| ------------------------------------------------------ | ----: |
| scripts/analyzeNavigationTrace.ts                      |    50 |
| scripts/dashboardLoadBenchmark.ts                      |    40 |
| scripts/autosaveBenchmark.ts                           |    30 |
| components/case/CaseEditSections.tsx                   |    14 |
| domain/avs/parser.ts                                   |    12 |
| components/app/widgets/ActivityWidget.tsx              |    10 |
| domain/common/sanitization.ts                          |    10 |
| components/case/CaseTable.tsx                          |     9 |
| utils/errorReporting.ts                                |     9 |
| components/app/widgets/WidgetSkeleton.tsx              |     8 |
| components/modals/AVSImportModal.tsx                   |     8 |
| hooks/useCaseListPreferences.ts                        |     8 |
| **tests**/integration/autosaveStatus.test.tsx          |     7 |
| components/app/Settings.tsx                            |     7 |
| components/app/widgets/AvgCaseProcessingTimeWidget.tsx |     7 |
| components/case/PersonColumn.tsx                       |     7 |
| components/category/CategoryManagerPanel.tsx           |     7 |
| components/financial/FinancialItemStepperModal.tsx     |     7 |
| components/financial/useFinancialItemCardState.ts      |     7 |
| components/settings/TemplateEditor.tsx                 |     7 |

## Hotspots by Status

- REVIEWED: 37

## Suggested Remediation Waves

1. High-volume rule sweeps: tackle top 3-5 rules across top files first.
2. Critical/Major non-test issues: prioritize by severity in production code paths.
3. Remaining test-file issues: batch-fix by rule family to reduce churn.
4. Hotspots review: confirm each REVIEWED hotspot disposition and close follow-up work.
5. Re-run tests/build and refresh SonarCloud scan after each wave.
