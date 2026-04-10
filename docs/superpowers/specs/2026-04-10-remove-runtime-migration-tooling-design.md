# Remove Runtime Migration Tooling Design

**Date:** 2026-04-10

## Goal

Remove the current migration product surface from CMSNext so the application only supports canonical persisted v2.2 workspace and archive files at runtime, while keeping a small dormant internal boundary that can be reused for future schema transitions such as v2.2 to v2.3.

## Scope

This slice covers:

- Removing workspace and archive migration execution from normal app/runtime flows.
- Removing Settings and devtools migration entrypoints and related flags.
- Removing the connection-time upgrade behavior and the upgrade confirmation modal.
- Making both workspace and archive reads strict persisted-v2.2-only.
- Refactoring the remaining storage helper boundary so it no longer presents itself as a v2.1 migration surface.
- Preserving a configurable internal stub boundary for future schema evolution work.

This slice does not cover:

- Broad removal of runtime compatibility fields such as `caseRecord.personId` or `caseRecord.spouseId`.
- Full alignment of persisted and hydrated runtime case/application shapes.
- The follow-up schema cleanup intended for the later “marry the 2.2 schema” slice.

## Context

CMSNext now treats persisted v2.2 as the only supported runtime format. The application currently still carries an explicit migration product surface that:

- runs migration orchestration on connection,
- migrates archive files as part of that orchestration,
- exposes migration-oriented feature flags and tooling,
- and still uses v2.1-oriented naming in the storage helper layer.

That behavior is no longer needed for real-world operation in this repository. There is one trusted file set and one operator. Any non-v2.2 file should be treated as unsupported input rather than an in-app migration scenario.

## Approved Direction

The system will separate `runtime format support` from `future schema evolution capability`.

Runtime behavior becomes strict and simple:

- the primary workspace file must already be canonical persisted v2.2,
- archive files must already be canonical persisted v2.2,
- normal runtime/UI flows never invoke migration code,
- and any non-v2.2 payload is rejected through the existing unsupported-format path.

Future schema evolution remains possible through a small internal scaffold that is not wired into UI, connection flows, or normal reads. That scaffold exists only to give future v2.3 work a clean home.

## Architecture

After this slice, the relevant storage architecture is:

1. `canonical v2.2 storage layer`
   - persisted v2.2 validation
   - persisted v2.2 hydration
   - persisted v2.2 dehydration
   - workspace and archive read/write behavior

2. `schema evolution stub boundary`
   - dormant internal interface for future explicit transforms
   - configurable enough to support a later v2.2 to v2.3 migration path
   - not callable from app startup, connection, or Settings UI

The current v2.1 and v2.0 migration implementation is removed as live product behavior, not renamed and left active.

The preferred implementation for the future migration scaffold is to create a new internal boundary under a new path such as `utils/migrations/` rather than leaving a hollowed-out `workspaceV21Migration.ts` or `storageV21Migration.ts` module behind. The goal is a visible break from the v2.1 migration era rather than a renamed shell that still suggests current runtime support.

## File-Level Cleanup Expectations

This slice should explicitly distinguish between files that are expected to be deleted and files that are expected to be refactored.

Candidate full deletions:

- `utils/workspaceV21Migration.ts`
- `components/modals/WorkspaceUpgradeNoticeModal.tsx`
- `components/diagnostics/WorkspaceMigrationPanel.tsx` if it is only a migration UI surface
- `utils/legacyMigration.ts` if it no longer serves any active non-runtime purpose after this cleanup

Candidate refactors or replacements:

- `utils/storageV21Migration.ts` should not survive under its current name if the remaining responsibility is canonical v2.2 storage support rather than migration
- `utils/DataManager.ts` should lose migration orchestration responsibilities but remain the orchestration layer for active runtime flows
- any future migration stub should move to a new explicit internal boundary such as `utils/migrations/schemaRunner.ts` or an equivalent path

## Component Breakdown

### 1. Runtime Load Path

Remove the migration pre-pass from the connection flow. The connection flow should return to a narrow responsibility:

- connect,
- load canonical workspace data,
- mark the workspace ready,
- surface unsupported-format errors if encountered.

The upgrade confirmation modal added for the transition period should be removed entirely because the runtime no longer upgrades anything.

Primary areas:

- `hooks/useConnectionFlow.ts`
- `components/app/AppContent.tsx`
- `components/modals/WorkspaceUpgradeNoticeModal.tsx`
- associated tests

### 2. Migration Tooling Removal

Remove the workspace and archive migration orchestration and report-generation flow.

Primary areas:

- `utils/DataManager.ts`
- `utils/workspaceV21Migration.ts`
- any Settings or diagnostics surfaces that still expose migration actions
- `components/diagnostics/WorkspaceMigrationPanel.tsx` if still wired
- `utils/legacyMigration.ts` if still present and still migration-only
- related tests and documentation

The archival feature remains. Only the archive-upgrade behavior is removed.

### 3. Canonical Storage Boundary Cleanup

The remaining helper surface currently named around `storageV21Migration` should be narrowed or renamed so it describes what actually remains:

- canonical persisted-v2.2 helpers,
- hydration and dehydration support,
- validation-adjacent helpers,
- and any temporary compatibility helpers still required by runtime code.

The public API should stop implying that migration is a supported runtime concern.

If feature flags or contexts still mention workspace migration, legacy import, upgrade previews, or related scaffolding, they should be removed rather than left inert. Primary cleanup should include `utils/featureFlags.ts` and any consuming settings/devtools wiring.

### 4. Archive Validation

Archive file handling should match workspace file handling:

- canonical persisted v2.2 is accepted,
- anything else is unsupported,
- no archive file is rewritten during normal use.

### 5. Future Migration Stub Boundary

Keep a minimal dormant contract for future explicit schema transforms. This should be internal-only and intentionally not exposed as a product feature.

Likely characteristics:

- explicit versioned transform inputs,
- explicit invocation only,
- no UI wiring,
- no automatic load-path invocation,
- no user-facing reporting behavior in this slice.

## Data Flow

The target normal flow is:

1. Connection succeeds.
2. `useConnectionFlow` requests normal workspace loading only.
3. `FileStorageService` accepts only canonical persisted v2.2 for the workspace file.
4. Archive services accept only canonical persisted v2.2 for archive files.
5. Hydration and dehydration helpers operate within the v2.2 contract only.
6. Any future schema-evolution scaffold remains dormant and is not called by runtime/UI flows.

## Error Handling

`LegacyFormatError` can remain as the mechanism for reporting unsupported runtime input, but its messaging should no longer refer to an in-app migration path.

For both workspace and archive files, unsupported-format behavior should mean:

- the file is rejected,
- the app does not attempt repair or conversion,
- and the message simply states that the file is not in the supported canonical format.

The operator-facing distinction between `outdated schema` and `corrupt file` should be explicit. A suitable target message for outdated runtime input is:

`This workspace is using an outdated schema (v2.1 or older). To load this file, it must be upgraded using a previous version of CMSNext.`

The implementation may adjust the wording slightly, but the message should preserve the key distinction that the file is outdated rather than ambiguously broken.

## Testing Strategy

The test suite should pivot from verifying migration correctness to verifying migration absence.

### Storage and Service Tests

Add or update tests to prove that:

- normal workspace reads reject non-v2.2 payloads,
- archive reads reject non-v2.2 payloads,
- canonical persisted v2.2 payloads still hydrate and write correctly,
- and no runtime service path silently upgrades data.

### Connection Flow Tests

Add or update tests to prove that:

- `useConnectionFlow` no longer invokes migration tooling,
- connection state no longer depends on migration reports,
- and no upgrade modal behavior remains.
- DataManager-backed connection/load mocks still reflect the intended lifecycle ordering after the migration pre-pass is removed.

### Product Surface Removal Tests

Add or update tests to prove that:

- migration controls are no longer wired in Settings/devtools,
- migration feature flags are gone or no longer meaningful,
- `utils/featureFlags.ts` no longer carries migration-oriented configuration,
- and archive flows do not auto-upgrade files.

### Future Stub Boundary Tests

If a migration stub contract is added in this slice, test it only as an isolated internal boundary. Do not treat it as a runtime feature.

## Risks

The main implementation risk is hidden coupling to helper functions and modules whose names still mention migration but are currently used for non-migration responsibilities.

A secondary risk is connection-state timing drift inside `DataManager` and the startup lifecycle after the migration pre-pass is removed. Eliminating that extra step will shorten the connection path and may expose tests or mocks that were implicitly relying on an intermediate migration tick.

The safest implementation order is:

1. remove live migration execution,
2. remove the upgrade UI and Settings entrypoints,
3. tighten workspace and archive read behavior,
4. then rename or narrow the remaining helper boundary so the surviving imports are explicit and intentional.

As part of that work, validate that connection and readiness transitions still occur in the expected order and do not introduce race conditions in startup tests or orchestration code.

## Out Of Scope Follow-Up

The follow-up slice will address the broader “marry the 2.2 schema” cleanup, including:

- reducing runtime compatibility fields,
- shrinking `CaseRecord` compatibility debt,
- and aligning persisted and hydrated runtime types more directly.

That work should happen after this slice establishes a clean “migration no longer exists at runtime” boundary.
