# Repository Alignment Stub Spec

> Stub notice: This is NOT a standard CMSNext feature spec.
>
> This document intentionally preserves the shape of a time-constrained audit reply so the team has a concrete placeholder for a later brainstorm and proper spec pass.
>
> It does not follow the normal `00-feature-spec.md` structure from [docs/development/features/templates/feature-spec.template.md](/workspaces/CMSNext/docs/development/features/templates/feature-spec.template.md) and should not be treated as an approved implementation spec.

## Source

- Created: 2026-04-13
- Basis: repository alignment audit reply captured directly into a stub spec artifact
- Intended follow-up: proper brainstorm session, then rewrite into the standard feature-spec shape

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
