# Repository Alignment Audit — Full Report

## Header

- Feature: Repository alignment — fix code/documentation drift and security gaps
- Status: Aligned
- Roadmap reference: [ROADMAP_APR_2026.md](/workspaces/CMSNext/docs/development/ROADMAP_APR_2026.md)
- Owner: `triage` (routing), then `storage`, `documentation`, `domain` per finding
- Primary specialization: Cross-cutting audit and remediation
- Related PRs: None yet
- Audit date: 2026-04-16
- Auditor: GitHub Copilot
- Origin: stub spec from 2026-04-13, verified and expanded against live codebase

---

## Problem

The repository's documentation, architectural claims, and runtime code have drifted apart since the v2.2 migration work, application canonicalization, and recent feature additions. Several documentation files make claims that are no longer true, one code defect has data-loss implications, and the encryption-at-rest story has real security gaps for secondary write paths.

Contributors, agents, and LLM reviewers relying on README.md, testing-guide.md, implementation-guide.md, llms.txt, or CLAUDE.md will receive materially wrong information about how the system works.

## Outcome

After remediation:

- Every documentation claim about encryption, autosave timing, domain purity, provider topology, service inventory, and testing setup matches the live codebase.
- The autosave debounce defect is fixed and the documented 5s/15s contract is honored.
- Encryption coverage for secondary write paths (archives, backups, exports) is either implemented or the documentation explicitly scopes the guarantee to the main data file only.
- Domain layer impurities are either refactored out or the purity contract is documented with honest caveats.
- llms.txt references resolve to files that exist.

---

## Scope

### In scope

- Fix the autosave debounce timing defect in `AutosaveFileService.notifyDataChange()`.
- Resolve the encryption documentation/implementation gap for archives, backups, and exports.
- Update stale documentation across README.md, testing-guide.md, implementation-guide.md, CLAUDE.md, and llms.txt.
- Document the actual domain purity boundary (or refactor violations out).
- Update service inventory and provider topology documentation.
- Fix broken llms.txt file references.
- Document undocumented features: activity-log archival, paper-cut reporting, pinned cases, app-shell workflows.

### Out of scope

- New feature development.
- Rewriting the encryption system (the fix is either extend encryption to secondary paths or scope the docs).
- Refactoring hooks to match the documented 40–50 line target (ongoing effort, not an alignment blocker).
- Redesigning the component-to-domain import pattern (widespread, low-risk, architecture-doc update preferred).

---

## Verified Findings

All findings from the original stub were verified against the live codebase on 2026-04-16 using targeted subagent exploration. Verdicts are noted alongside each finding.

### Finding 1 — HIGH: Encryption at rest does not cover all persisted outputs

**Verdict: CONFIRMED — accurate with nuances the stub missed.**

**What the docs claim:**

- README.md line 11: _"Case data lives in JSON files on disk, is encrypted at rest"_
- README.md line 138: _"AES-256-GCM encryption for data at rest"_

**What actually happens:**

| Write path                           | File                                                                                   | Encrypted?                                |
| ------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------- |
| Main data file (`_performWrite`)     | [AutosaveFileService.ts](/workspaces/CMSNext/utils/AutosaveFileService.ts#L680)        | Yes, when `ENCRYPTION_MODE=full`          |
| Named-file writes (`writeNamedFile`) | [AutosaveFileService.ts](/workspaces/CMSNext/utils/AutosaveFileService.ts#L806)        | Always plain JSON                         |
| Archive files                        | [CaseArchiveService.ts](/workspaces/CMSNext/utils/services/CaseArchiveService.ts#L750) | Always plain JSON (uses `writeNamedFile`) |
| Backup files                         | [AutosaveFileService.ts](/workspaces/CMSNext/utils/AutosaveFileService.ts#L853)        | Always plain JSON (uses `writeNamedFile`) |
| Export downloads                     | [Settings.tsx](/workspaces/CMSNext/components/app/Settings.tsx#L105)                   | Always plain JSON blob                    |

**Nuance the stub missed:** The main data file IS encrypted when `ENCRYPTION_MODE=full`, which is enforced in production/staging builds. The encryption architecture in [EncryptionContext.tsx](/workspaces/CMSNext/contexts/EncryptionContext.tsx) and [useEncryptionFileHooks.ts](/workspaces/CMSNext/hooks/useEncryptionFileHooks.ts) is conditional — hooks are only installed when `isEncryptionEnabled === true` (full mode). In dev, `ENCRYPTION_MODE` defaults to `disabled`.

**Why this matters:** The README's blanket claim ("encrypted at rest") is misleading. Archives, backups, and exports leave case data in plaintext on disk even when encryption is active. This is a real product-level gap for users who expect full encryption.

**Ownership:** `storage` (code fix) + `documentation` (docs correction)

---

### Finding 2 — HIGH: Autosave debounce timing defect

**Verdict: CONFIRMED — accurate, code defect is real.**

**What the docs claim:**

- README.md and CLAUDE.md: ~5 seconds normal debounce, ~15 seconds bulk operations.
- Actual constants match: `debounceDelay = 5000`, bulk = `Math.min(debounceDelay * 3, 15000)`.

**The defect** in [AutosaveFileService.ts](/workspaces/CMSNext/utils/AutosaveFileService.ts#L1570):

```typescript
notifyDataChange(): void {
  this.state.lastDataChange = Date.now();       // Line 1575: SET timestamp
  // ...
  const now = Date.now();                        // Line 1578: GET current time
  const timeSinceLastChange = this.state.lastDataChange
    ? now - this.state.lastDataChange            // Always ≈ 0ms
    : Infinity;
  const isBulkOperation = timeSinceLastChange < 2000;  // Always TRUE
```

Because `lastDataChange` is set **before** the elapsed-time computation, `now - lastDataChange` is always ~0ms, making `isBulkOperation` always `true`. Every normal edit uses the 15-second bulk delay instead of the documented 5-second delay.

**Data-loss implication:** The save window is 3x longer than documented. A browser crash, tab close, or power failure during the extra 10 seconds causes data loss the user did not expect.

**Fix:** Compute elapsed time before updating `lastDataChange`, or store the previous value before overwriting.

**Ownership:** `storage`

---

### Finding 3 — HIGH: Testing documentation is materially stale

**Verdict: CONFIRMED — all claims accurate.**

| Stale claim                                     | Location                                                                              | Current reality                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global setup file is `__tests__/setup.test.tsx` | [testing-guide.md](/workspaces/CMSNext/.github/testing-guide.md) line 14 and line 282 | Actual file: [src/test/setup.ts](/workspaces/CMSNext/src/test/setup.ts); configured in [vitest.config.ts](/workspaces/CMSNext/vitest.config.ts#L14) |
| `npm test` is watch mode                        | [testing-guide.md](/workspaces/CMSNext/.github/testing-guide.md) line 18              | `npm test` runs `vitest run` (single-run); watch mode is `npm run test:watch`                                                                       |

**Note:** `__tests__/setup.test.tsx` still exists but is a test file (with `it()` blocks), not the global setup. The stale reference appears in two separate locations within testing-guide.md.

**Ownership:** `documentation`

---

### Finding 4 — HIGH: Domain purity contract is overstated

**Verdict: CONFIRMED — multiple violations found.**

**What the docs claim:**

- README.md: _"domain/: pure business logic, no React, no I/O"_
- llms.txt: _"Keep domain layer pure (no React, no I/O)"_
- CLAUDE.md: _"Pure functions only — no classes, no I/O, no React imports, no side effects"_

**Actual violations found:**

| Category               | File                                                                                       | Details                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Browser scheduling API | [domain/avs/parser.ts](/workspaces/CMSNext/domain/avs/parser.ts#L29)                       | `requestIdleCallback` / `setTimeout` via `globalThis` — async browser coordination |
| Timestamp generation   | [domain/archive/archivalLogic.ts](/workspaces/CMSNext/domain/archive/archivalLogic.ts#L69) | `new Date()` defaults in 4 locations (lines 69, 104, 267, 347)                     |
| Timestamp generation   | [domain/financials/history.ts](/workspaces/CMSNext/domain/financials/history.ts#L20)       | `new Date()` default parameter                                                     |
| UUID generation        | [domain/financials/history.ts](/workspaces/CMSNext/domain/financials/history.ts#L8)        | `import { v4 as uuidv4 } from "uuid"`                                              |
| Crypto and RNG         | [domain/common/normalization.ts](/workspaces/CMSNext/domain/common/normalization.ts#L40)   | `crypto.randomUUID()`, `Date.now()`, `Math.random()` in `generateFallbackId()`     |
| Utility import         | [domain/dashboard/widgets.ts](/workspaces/CMSNext/domain/dashboard/widgets.ts#L17)         | Import from `@/utils/alertsData` (low severity)                                    |

**What IS clean:** No React imports, no hook imports, no context imports found in `domain/`.

**Severity assessment:** The browser API usage in `avs/parser.ts` is the most serious violation (breaks test portability). The timestamp/ID generation makes functions non-deterministic but is a softer violation (injectable via parameters).

**Decision required:** Either refactor violations into the service layer, or update the purity contract documentation to describe the actual boundary honestly. The pragmatic path is likely a mix: move `yieldToMain()` out of domain, pass timestamps and IDs as parameters, and update docs to say "deterministic functions preferred, no React/hooks/contexts" rather than "pure, no I/O."

**Ownership:** `domain` (code fix) + `documentation` (docs update)

---

### Finding 5 — MEDIUM: Architecture docs lag the live provider and service topology

**Verdict: CONFIRMED — provider stack and service inventory both outdated.**

**Provider stack gaps:**

- README.md omits the outer `<ErrorBoundary>` wrapping `<App />` in [main.tsx](/workspaces/CMSNext/main.tsx#L5)
- README.md omits the `<FileStorageIntegrator>` layer in [App.tsx](/workspaces/CMSNext/App.tsx#L40)
- Internal provider ordering within `AppProviders` is correct

**Service inventory gaps in [implementation-guide.md](/workspaces/CMSNext/.github/implementation-guide.md):**

- Documented: 7 services (FileStorageService, CaseService, FinancialsService, NotesService, ActivityLogService, CategoryConfigService, AlertsService)
- Actual: 11 services — missing PersonService, TemplateService, ApplicationService, CaseArchiveService

**Ownership:** `documentation`

---

### Finding 6 — MEDIUM: llms.txt has broken file references

**Verdict: CONFIRMED — two broken references found.**

| Referenced path                                 | Exists? | Likely intended file                   |
| ----------------------------------------------- | ------- | -------------------------------------- |
| `docs/audit/sonarcloud-cloud-issues-summary.md` | No      | `docs/audit/sonarcloud-open-issues.md` |
| `docs/audit/sonarcloud-open-issues.json`        | No      | `docs/audit/sonarcloud-hotspots.json`  |

**Ownership:** `documentation`

---

### Finding 7 — MEDIUM: Feature docs understate and overstate shipped functionality

**Verdict: CONFIRMED — template category count is wrong.**

- README.md claims three template categories (_"VR, summary, and narrative"_).
- [types/template.ts](/workspaces/CMSNext/types/template.ts#L15) defines four: `'vr' | 'vrFooter' | 'summary' | 'narrative'`.
- The `vrFooter` category was added after the docs were written.

Import/export wording in the README is slightly broader than implemented, but not materially misleading.

**Ownership:** `documentation`

---

### Finding 8 — MEDIUM: Hook and component layer boundaries have drifted from docs

**Verdict: CONFIRMED — hooks are controller-scale, components import domain directly.**

**Hook size drift:**

- Documented target: 40–50 lines per hook.
- [useIntakeWorkflow.ts](/workspaces/CMSNext/hooks/useIntakeWorkflow.ts): ~650 lines
- [useAlertsFlow.ts](/workspaces/CMSNext/hooks/useAlertsFlow.ts): ~250 lines
- [useCaseManagement.ts](/workspaces/CMSNext/hooks/useCaseManagement.ts): ~180 lines

These are controller-scale workflow modules, not thin state wrappers.

**Component-to-domain imports:** ~47 instances found across `components/` importing directly from `@/domain` (formatting, calculations, priority scoring). No direct service imports from components were found, so the layering violation is limited to the domain shortcut.

**Assessment:** This is architecture-doc drift, not an acute correctness bug. The practical pattern (components using domain formatters directly) is reasonable. The docs should describe the real convention rather than the aspirational one.

**Ownership:** `documentation` (update boundary docs) + `hooks` (ongoing decomposition effort)

---

## Documentation Gaps (Verified)

All four documentation gaps from the stub were confirmed:

### Gap 1: Storage flow presented as monolithic

The docs present storage as a single flow, but the runtime has distinct, separately orchestrated workflows: connection, permission recovery, loading, autosave state management, encryption unlock, and file-data synchronization. These are owned across `FileStorageContext`, `EncryptionContext`, `useConnectionFlow`, `useFileDataSync`, `useEncryptionFileHooks`, and `AutosaveFileService`. None of the product docs explain this separation.

### Gap 2: Applications and archives lack business-logic documentation

`applications[]` and archive files are documented only at the data-schema level. Their business workflows (application lifecycle, archival eligibility, round-trip rules) are undocumented in README.md, CLAUDE.md, or implementation-guide.md.

### Gap 3: App-shell features are undocumented

The following shipped features have no product-level documentation:

- Autosave status indicator ([AutosaveStatusBadge.tsx](/workspaces/CMSNext/components/app/AutosaveStatusBadge.tsx))
- Paper-cut reporting ([PaperCutModal.tsx](/workspaces/CMSNext/components/common/PaperCutModal.tsx), [PaperCutsPanel](/workspaces/CMSNext/components/settings/PaperCutsPanel))
- Pinned cases with drag-reorder ([usePinnedCases.ts](/workspaces/CMSNext/hooks/usePinnedCases.ts))
- Connection onboarding and folder selection ([ConnectionOnboarding.tsx](/workspaces/CMSNext/components/app/ConnectionOnboarding.tsx))
- App loading state sequence ([AppLoadingState.tsx](/workspaces/CMSNext/components/app/AppLoadingState.tsx))
- Cross-component DOM events (`app:navigate`, `app:newcase`, `app:focussearch`, `app:togglesidebar`)

### Gap 4: Activity-log archival is undocumented

[ActivityLogService.ts](/workspaces/CMSNext/utils/services/ActivityLogService.ts) implements full auto-archival: 90-day retention, yearly archive files (`activityLog-archive-{year}.json`), and `autoArchive()` method. This was completed per the February 2026 roadmap but never added to product docs.

---

## Stale Docs Inventory

| File                                                                           | Specific stale content                                                                                                                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [README.md](/workspaces/CMSNext/README.md)                                     | Encryption claim (blanket "encrypted at rest"), template categories (3 vs 4), provider stack (missing ErrorBoundary, FileStorageIntegrator), domain purity claim |
| [testing-guide.md](/workspaces/CMSNext/.github/testing-guide.md)               | Setup file path (2 locations), `npm test` behavior                                                                                                               |
| [implementation-guide.md](/workspaces/CMSNext/.github/implementation-guide.md) | Service inventory (7 listed, 11 actual)                                                                                                                          |
| [CLAUDE.md](/workspaces/CMSNext/CLAUDE.md)                                     | Domain purity claim, hook size target (aspirational vs actual), undocumented features                                                                            |
| [llms.txt](/workspaces/CMSNext/llms.txt)                                       | Two broken Sonar file references, domain purity claim                                                                                                            |
| [ui-guide.md](/workspaces/CMSNext/.github/ui-guide.md)                         | No stale content detected                                                                                                                                        |

---

## Architectural Ownership

- Primary layer: Cross-cutting (storage, documentation, domain)
- Expected agent owner: `triage` for routing, then:
  - `storage` for Findings 1 (encryption) and 2 (autosave defect)
  - `documentation` for Findings 3, 5, 6, 7, and all stale-docs work
  - `domain` for Finding 4 (purity violations)
  - `hooks` for Finding 8 (ongoing hook decomposition)
- Secondary concerns: `audit` for verification after remediation

## Constraints To Preserve

- Local-first behavior only.
- Layered architecture: `domain -> services/DataManager -> hooks -> components`.
- Existing provider and storage contracts.
- Existing repo validation expectations.
- Encryption opt-in model (per-environment `ENCRYPTION_MODE`).
- Autosave must honor the documented 5s normal / 15s bulk contract after the fix.

---

## Acceptance Criteria

- [ ] **F1:** Either `writeNamedFile` encrypts when encryption is active, OR all docs explicitly scope the encryption guarantee to the main data file only. Decision documented.
- [ ] **F2:** `notifyDataChange()` computes elapsed time before updating `lastDataChange`. Normal edits use 5s delay. Existing test coverage updated or added to lock the timing contract.
- [ ] **F3:** testing-guide.md references `src/test/setup.ts` (not `__tests__/setup.test.tsx`) and documents `npm test` as single-run.
- [ ] **F4:** Domain purity violations either refactored (scheduler, ID generation) or purity contract updated to describe the actual boundary. At minimum, `yieldToMain()` moved out of `domain/`.
- [ ] **F5:** README.md provider stack includes ErrorBoundary and FileStorageIntegrator. implementation-guide.md lists all 11 services.
- [ ] **F6:** llms.txt references point to files that exist.
- [ ] **F7:** README.md lists four template categories.
- [ ] **F8:** Hook boundary docs updated to describe the controller-scale pattern honestly, with the 40–50 line target framed as aspirational.
- [ ] **Gaps:** At least one paragraph each for activity-log archival, app-shell features, and the multi-workflow storage model added to product docs.
- [ ] All validation commands pass: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`.

---

## Risks

- **F1 decision risk:** Extending encryption to `writeNamedFile` is a significant implementation effort that could introduce regressions in archive and backup flows. The documentation-only fix is lower risk but leaves a real security gap.
- **F2 timing change:** Fixing the debounce changes save frequency from ~15s to ~5s for normal edits. This increases disk I/O and could surface latent write-path bugs that were masked by the longer delay.
- **F4 refactoring risk:** Moving `yieldToMain()` out of the domain layer requires touching the AVS parser's async chunking logic, which is performance-sensitive.
- **Documentation volume:** Updating 5–6 docs files simultaneously risks merge conflicts if other work lands in parallel.

## Validation Expectations

- Required commands: `npm run typecheck && npm run lint && npm run test:run && npm run build`
- Required regression coverage: F2 (autosave timing) must have a test locking the debounce delay selection logic
- Required manual checks: After F2, verify autosave badge timing in browser
- Documentation review: All updated docs checked for internal consistency

## Sequencing Recommendation

1. **F2 first (autosave defect)** — highest data-loss risk, smallest code change, cleanest to verify.
2. **F3 + F6 + F7 (quick doc fixes)** — low-risk, high-value documentation corrections.
3. **F5 (architecture docs)** — provider stack and service inventory updates.
4. **F1 (encryption decision)** — requires a design decision before implementation; document the decision even if code change is deferred.
5. **F4 (domain purity)** — mix of code refactoring and doc updates; can be phased.
6. **F8 + documentation gaps** — boundary docs and missing feature documentation; lowest urgency.

## Open Questions

- Should `writeNamedFile` be extended with conditional encryption, or should the docs scope the guarantee? This is a product decision, not a pure engineering one.
- Is the `yieldToMain()` scheduling in `domain/avs/parser.ts` a performance requirement that prevents moving it to the service layer, or can the caller provide a yield function?
- Should the 40–50 line hook target be removed from docs entirely, or kept as an aspirational guideline with the caveat that workflow hooks will be larger?

# Repository Alignment Audit — Full Report

## Header

- Feature: Repository alignment — fix code/documentation drift and security gaps
- Status: Aligned
- Roadmap reference: [ROADMAP_APR_2026.md](/workspaces/CMSNext/docs/development/ROADMAP_APR_2026.md)
- Owner: `triage` (routing), then `storage`, `documentation`, `domain` per finding
- Primary specialization: Cross-cutting audit and remediation
- Related PRs: None yet
- Audit date: 2026-04-16
- Auditor: GitHub Copilot
- Origin: stub spec from 2026-04-13, verified and expanded against live codebase

---

## Problem

The repository's documentation, architectural claims, and runtime code have drifted apart since the v2.2 migration work, application canonicalization, and recent feature additions. Several documentation files make claims that are no longer true, one code defect has data-loss implications, and the encryption-at-rest story has real security gaps for secondary write paths.

Contributors, agents, and LLM reviewers relying on README.md, testing-guide.md, implementation-guide.md, llms.txt, or CLAUDE.md will receive materially wrong information about how the system works.

## Outcome

After remediation:

- Every documentation claim about encryption, autosave timing, domain purity, provider topology, service inventory, and testing setup matches the live codebase.
- The autosave debounce defect is fixed and the documented 5s/15s contract is honored.
- Encryption coverage for secondary write paths (archives, backups, exports) is either implemented or the documentation explicitly scopes the guarantee to the main data file only.
- Domain layer impurities are either refactored out or the purity contract is documented with honest caveats.
- llms.txt references resolve to files that exist.

---

## Scope

### In scope

- Fix the autosave debounce timing defect in `AutosaveFileService.notifyDataChange()`.
- Resolve the encryption documentation/implementation gap for archives, backups, and exports.
- Update stale documentation across README.md, testing-guide.md, implementation-guide.md, CLAUDE.md, and llms.txt.
- Document the actual domain purity boundary (or refactor violations out).
- Update service inventory and provider topology documentation.
- Fix broken llms.txt file references.
- Document undocumented features: activity-log archival, paper-cut reporting, pinned cases, app-shell workflows.

### Out of scope

- New feature development.
- Rewriting the encryption system (the fix is either extend encryption to secondary paths or scope the docs).
- Refactoring hooks to match the documented 40–50 line target (ongoing effort, not an alignment blocker).
- Redesigning the component-to-domain import pattern (widespread, low-risk, architecture-doc update preferred).

## Findings

1. High: The storage/security spec is not true for all persisted outputs. The repo says case data is encrypted at rest in [README.md](/workspaces/CMSNext/README.md#L141), but named-file writes are plain JSON in [utils/AutosaveFileService.ts](/workspaces/CMSNext/utils/AutosaveFileService.ts#L806), archive files use that path in [utils/services/CaseArchiveService.ts](/workspaces/CMSNext/utils/services/CaseArchiveService.ts#L750), backups use it in [utils/AutosaveFileService.ts](/workspaces/CMSNext/utils/AutosaveFileService.ts#L853), and export downloads are plain blobs in [components/app/Settings.tsx](/workspaces/CMSNext/components/app/Settings.tsx#L105). This is not just stale documentation; it is a real product-level gap.

2. High: The documented autosave timing does not match the implementation, and the current implementation appears wrong. The docs promise roughly 5s normal and 15s bulk debounce in [README.md](/workspaces/CMSNext/README.md#L148), but [utils/AutosaveFileService.ts](/workspaces/CMSNext/utils/AutosaveFileService.ts#L1574) sets `lastDataChange` before computing elapsed time, so the bulk-operation check at [utils/AutosaveFileService.ts](/workspaces/CMSNext/utils/AutosaveFileService.ts#L1578) effectively classifies normal edits as bulk. That is a code defect with data-loss implications, and it also makes the docs misleading.

3. High: The testing docs are materially stale. [testing-guide.md](/workspaces/CMSNext/.github/testing-guide.md#L13) still says the global setup file is `__tests__/setup.test.tsx`, and [testing-guide.md](/workspaces/CMSNext/.github/testing-guide.md#L18) says `npm test` is watch mode. The actual setup file is [src/test/setup.ts](/workspaces/CMSNext/src/test/setup.ts), Vitest is configured there in [vitest.config.ts](/workspaces/CMSNext/vitest.config.ts#L14), and `npm test` is single-run while `test:watch` is the watch script in [package.json](/workspaces/CMSNext/package.json#L13). This is the biggest documentation-quality problem for contributors.

4. High: The documented domain purity contract is overstated. The repo describes `domain/*` as pure, with no I/O or browser API usage in [README.md](/workspaces/CMSNext/README.md#L208) and [llms.txt](/workspaces/CMSNext/llms.txt#L19), but [domain/avs/parser.ts](/workspaces/CMSNext/domain/avs/parser.ts#L8) uses `requestIdleCallback`/`setTimeout`, and several domain modules generate IDs, timestamps, or style-adjacent data. That means either the code needs refactoring toward true purity, or the docs need to describe the actual boundary more honestly.

5. Medium: The architectural docs lag the live service and provider topology. The provider stack in [README.md](/workspaces/CMSNext/README.md#L215) omits the outer error boundary in [main.tsx](/workspaces/CMSNext/main.tsx#L6) and the `FileStorageIntegrator` layer in [App.tsx](/workspaces/CMSNext/App.tsx#L76). The service inventory in [.github/implementation-guide.md](/workspaces/CMSNext/.github/implementation-guide.md#L43) is also outdated relative to current `DataManager` responsibilities. This is a documentation/spec drift issue more than a runtime bug, but it will mislead future changes.

6. Medium: The repo’s machine-readable index has broken references. [llms.txt](/workspaces/CMSNext/llms.txt#L13) points at Sonar files that do not exist, which undermines the stated purpose of that file as a review index.

7. Medium: Public feature docs understate shipped functionality in some places and overstate it in others. The README still says the template system has three categories at [README.md](/workspaces/CMSNext/README.md#L51), but the type model defines four in [types/template.ts](/workspaces/CMSNext/types/template.ts#L15). Separately, the README’s import/export wording at [README.md](/workspaces/CMSNext/README.md#L59) reads much broader than the currently implemented export surface described by the storage audit.

8. Medium: The hooks and frontend layers have drifted from the documented boundaries. The docs still frame hooks as thin local-state wrappers and components as UI-only, but the real hook layer contains controller-scale workflow modules, and components import domain helpers directly in multiple places. I did not find direct service imports from components, so this is mostly architecture-doc drift, not an acute correctness bug.

## Documentation Gaps

- The current docs do not clearly explain that connection, permission recovery, loading, autosave state, encryption unlock state, and file-data synchronization are separate workflows owned across providers and hooks rather than a single simple storage flow.
- Application and archive behavior is documented mostly at the persisted-data level, but not as active first-class modules with real business rules.
- The top-level docs under-document current app-shell behavior such as paper-cut reporting, shortcut help, pinned cases, autosave status, and the richer onboarding/login paths.
- Activity-log archival behavior exists in code but is not surfaced clearly in the main product/spec docs.

## Stale Docs Candidates

- [README.md](/workspaces/CMSNext/README.md)
- [.github/testing-guide.md](/workspaces/CMSNext/.github/testing-guide.md)
- [.github/implementation-guide.md](/workspaces/CMSNext/.github/implementation-guide.md)
- [.github/ui-guide.md](/workspaces/CMSNext/.github/ui-guide.md)
- [llms.txt](/workspaces/CMSNext/llms.txt)
- [CLAUDE.md](/workspaces/CMSNext/CLAUDE.md)

## Codebase Gaps

- Encryption coverage for archives, backups, and exports.
- Autosave debounce logic in [utils/AutosaveFileService.ts](/workspaces/CMSNext/utils/AutosaveFileService.ts#L1572).
- Domain purity and UI-style leakage from `domain/*`.
- Activity logging coverage is narrower than several docs and comments imply.
- A few UI/accessibility and shell consistency issues exist, but they are secondary to the storage and architectural mismatches above.

## Follow-Up Notes

This was a read-only audit using separate layer-focused subagents. No files were edited during the audit itself, and no new validation pass was run as part of that review.

When the team returns for a proper brainstorm, this stub should be rewritten into a normal spec shape that at minimum covers:

- problem statement and intended outcome
- scope and out-of-scope cleanup decisions
- ownership split between docs fixes and code fixes
- acceptance criteria for alignment completion
- validation expectations
- sequencing for high-risk fixes versus pure documentation cleanup
