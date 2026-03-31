# CMSNext Audit Report - April 2026

**Date:** March 31, 2026
**Auditor:** GitHub Copilot (`audit` agent)
**Scope:** Monthly repository audit for April 2026 using repo standards from `.github/copilot-instructions.md`, `.github/implementation-guide.md`, `.github/ui-guide.md`, and `.github/testing-guide.md`

## Summary

| Area | Status | Notes |
| --- | --- | --- |
| Typecheck | ✅ | `npm run typecheck` passed |
| Lint | ✅ | `npm run lint` passed with zero warnings |
| Tests | ❌ | `npm run test:run` failed: 1524/1526 tests passed |
| Build | ✅ | `npm run build` passed in 33.06s |
| Architecture | ✅ | Spot checks found no React/I/O usage in `domain/` and no `fetch()` usage in app code |
| Accessibility | ⚠️ | Confirmed keyboard-access regression in linked-person chips |
| Logging Policy | ⚠️ | Production `console.*` usage still present in multiple files |

## Findings

### High

#### 1. Linked people without phone numbers are no longer keyboard-accessible

- **Severity:** High
- **File path and area:** `/home/runner/work/CMSNext/CMSNext/components/case/CaseDetails.tsx` lines 275-301
- **What is wrong:** In the linked-people chip list, entries with a phone number render as clickable `<button>` elements, but entries without a phone number render as a plain `<span>` inside `TooltipTrigger`. That removes keyboard focusability and prevents keyboard users from reaching the tooltip content for those people. The current behavior also breaks the existing regression test in `/home/runner/work/CMSNext/CMSNext/__tests__/components/case/CaseDetails.test.tsx` lines 308-314.
- **Why it matters:** Household/contact details become pointer-only for a subset of linked people, which is an accessibility regression and a loss of parity within the same UI pattern. Assistive-tech and keyboard users cannot discover the associated email/"not provided" details for non-phone entries.
- **What should change:** Restore a focusable trigger for every linked-person chip. If non-phone entries are intentionally non-copyable, they should still render as an accessible button-like trigger (or equivalent focusable control) so tooltip content remains reachable by keyboard, with semantics that clearly distinguish copyable vs. non-copyable chips.

### Medium

#### 2. The full test suite is red because one intake-workflow test still asserts the old toast contract

- **Severity:** Medium
- **File path and area:** `/home/runner/work/CMSNext/CMSNext/__tests__/hooks/useIntakeWorkflow.test.ts` lines 724-732; implementation at `/home/runner/work/CMSNext/CMSNext/hooks/useIntakeWorkflow.ts` lines 558-565
- **What is wrong:** The hook now prefixes edit-save failures with `Failed to save changes: ...`, but the regression test still expects the older unprefixed toast text. The suite therefore fails even though the hook sets the inline error to the underlying message and the toast to the new prefixed copy.
- **Why it matters:** CI is red for a stale expectation, which reduces confidence in the test suite and makes it harder to distinguish real product regressions from outdated assertions.
- **What should change:** Update the test to assert the current toast contract, or intentionally revert the hook message format if the unprefixed copy is the desired product behavior. Either way, the test and implementation need to agree again.

#### 3. Production code still bypasses the required structured logger with live `console.*` calls

- **Severity:** Medium
- **File path and area:** Representative current instances include `/home/runner/work/CMSNext/CMSNext/components/common/GlobalContextMenu.tsx` line 91, `/home/runner/work/CMSNext/CMSNext/components/diagnostics/FileStorageSettings.tsx` lines 56-62, 77-90, and 145-162, `/home/runner/work/CMSNext/CMSNext/components/app/Settings.tsx` lines 130-132 and 535-547, and `/home/runner/work/CMSNext/CMSNext/utils/dataExportImport.ts` lines 31-33
- **What is wrong:** These files still emit `console.warn`, `console.log`, or `console.error` directly in production paths instead of routing diagnostics through `createLogger`.
- **Why it matters:** This violates the repo's zero-console policy, makes diagnostics inconsistent, and can leak internal state or noisy debugging output into end-user/browser consoles.
- **What should change:** Replace live `console.*` usage with the shared structured logger, and remove debug-only logging/UI affordances that exist only to dump internals to the console.

## Open Questions or Assumptions

- I treated `/home/runner/work/CMSNext/CMSNext/docs/audit/AUDIT_REPORT_2026_01.md` as the closest existing template for a monthly audit because it is the most recent month-level audit file in `docs/audit/`.
- I treated the failing intake-workflow toast assertion as a test-contract drift rather than a confirmed product defect because the implementation change is explicit and internally consistent.

## Validation Performed

- Read repository guidance from:
  - `/home/runner/work/CMSNext/CMSNext/README.md`
  - `/home/runner/work/CMSNext/CMSNext/.github/implementation-guide.md`
  - `/home/runner/work/CMSNext/CMSNext/.github/ui-guide.md`
  - `/home/runner/work/CMSNext/CMSNext/.github/testing-guide.md`
- Reviewed prior audit artifacts in `/home/runner/work/CMSNext/CMSNext/docs/audit/`
- Ran repository quality gates from `/home/runner/work/CMSNext/CMSNext`:
  - `npm run typecheck` ✅
  - `npm run lint` ✅
  - `npm run test:run` ❌ (`1524/1526` tests passed; 2 failures)
  - `npm run build` ✅ (33.06s)
- Ran targeted static checks for:
  - React/browser/storage usage inside `domain/` (no confirmed violations in the spot check)
  - `fetch()` usage in application code (none found)
  - Live `console.*` usage in production paths (confirmed in multiple files)

## Residual Risks or Coverage Gaps

- The accessibility assessment here is static plus test-output-driven; it does not include manual runtime verification of keyboard traversal in a browser.
- `npm run test:run` emitted additional React `act(...)` warnings in `/home/runner/work/CMSNext/CMSNext/__tests__/hooks/useIntakeWorkflow.test.ts`; these did not fail the suite but indicate extra test-hygiene debt.
- The test run also emitted repeated localStorage parse warnings for malformed `cmsnext-theme` and `cmsnext-error-reports` values in the test environment. I did not classify those as product findings because the evidence here does not show a real browser path writing the literal string `undefined`.
- This audit did not re-run external SonarCloud or browser-based accessibility tooling; it is limited to repository inspection and local validation commands.

## Next Audit

**Due:** April 30, 2026
