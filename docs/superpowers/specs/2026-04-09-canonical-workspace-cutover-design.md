# Canonical Workspace Cutover Design

## Goal

Land the application migration-bridge cleanup safely by introducing a strict canonical workspace version boundary and resolving the current status-domain mismatch without expanding this PR into the larger configurable-status redesign.

## Scope

This slice covers two decisions:

- move bridge-free canonical application ownership onto a new persisted workspace version
- stop treating application status as a separate hard-coded domain for this slice by reusing the existing case-status type directly

This slice does not complete the broader status-model redesign. It also does not solve the multi-write atomicity problem introduced by separate case and application updates during intake edit; that remains a follow-up once the persisted schema and status ownership are stable.

## Core Decisions

- Canonical post-bridge workspaces use persisted version `2.2`.
- Existing bridge-era `2.1` workspaces are treated as legacy-at-load, not as a second valid canonical shape.
- App startup automatically upgrades a loaded `2.1` workspace to `2.2`, writes the upgraded file back once, shows a one-time notice, and then continues with the upgraded payload.
- Normal runtime reads operate only on the new canonical version after migration.
- For this slice, application records reuse the same status type and values as case records rather than mapping into a separate application-status enum.
- Terminal or completed behavior continues to be determined by configuration semantics such as `countsAsCompleted`, not by a hard-coded application-status vocabulary.
- The separate, fully config-driven shared status namespace for both case and application records is the next PR, not part of this slice.

## Version Cutover

The current bridge-removal work tightened the meaning of canonical persisted data. Under the old bridge-era behavior, a workspace could still rely on case-embedded legacy application fields and have missing or empty top-level `applications[]` while remaining readable at runtime. After bridge removal, that ambiguity is unsafe because normal dehydration strips application-owned case fields and now writes only the canonical `applications[]` collection.

The design answer is a version cutover, not additional lazy compatibility logic. Persisted version `2.2` becomes the only canonical bridge-free runtime format. Persisted version `2.1` remains migratable, but it is no longer treated as already canonical for normal runtime use.

This keeps the model honest:

- `2.1` means bridge-era normalized workspace
- `2.2` means canonical post-bridge workspace

For this project, the upgrade flow should be automatic because there is one active operator and one save file. The app should not ask the user to manually run a migration tool before working. Instead, it should detect `2.1`, migrate it forward, persist `2.2`, show a one-time notice that the workspace was upgraded, and then continue with the upgraded payload.

## Runtime Read And Upgrade Flow

The intended startup flow is:

1. Read raw file contents.
2. If the workspace is already canonical `2.2`, continue normally.
3. If the workspace is persisted `2.1`, run the explicit upgrade path to canonical `2.2` before normal runtime hydration continues.
4. Write the upgraded `2.2` file back once.
5. Surface a lightweight one-time notice that the workspace was upgraded.
6. Continue all normal runtime behavior against the upgraded `2.2` payload only.

This removes the current ambiguity where a `2.1` file may be structurally readable but semantically non-canonical for bridge-free writes.

Normal runtime read paths should remain strict after this change. They should not continue accepting mixed old and new semantics under the same version label.

## Status Model For This Slice

The current code has a mismatch in intent:

- case status behavior is supposed to be driven primarily by status configuration
- application records currently define a separate hard-coded application-status domain

The bridge-removal PR exposed that mismatch because canonical application creation now assigns status directly from the case record. Adding a mapping from case status into the current application-status enum would patch the symptom but move the code farther from the intended model.

For this slice, application records should reuse the existing case-status type directly. That means the application record continues to own its own status and status history, but the status value is drawn from the same vocabulary currently used by the case record layer.

This is intentionally transitional. The follow-up PR should remove the remaining hard-coded status assumptions and make both case and application status vocabularies flow through the configurable status namespace.

## Consequences Of The Transitional Status Decision

This slice deliberately chooses the smallest credible correction:

- it removes the unsafe status cast between incompatible domains
- it avoids inventing a mapping rule that the product does not want
- it keeps this PR focused on schema cutover and bridge removal rather than a broader workflow rewrite

Known debt intentionally left in place:

- hard-coded case-status typing still exists for one more slice
- application status temporarily inherits that same typed vocabulary instead of being fully config-driven
- true shared configurable status ownership across both record types is deferred

## Testing Strategy

Add or update tests to prove the cutover behavior explicitly.

Required coverage:

- loading a persisted `2.1` workspace automatically upgrades it to canonical `2.2`
- the upgraded file is written back once during the cutover path
- normal runtime reads continue only after the upgraded `2.2` payload is available
- bridge-era workspaces with legacy case-embedded application fields do not silently lose application data during the cutover
- canonical application creation writes a status value valid under the shared case-status type for this slice
- status-history initialization uses the same status value as the created application record

The tests for this slice do not need to solve the full config-driven status redesign. They only need to prove that status ownership is internally consistent and no longer depends on an invalid cross-domain cast.

## Out Of Scope

- full config-driven shared status namespace across case and application records
- redesign of status configuration types
- hook or service refactor for atomic combined case and application writes
- new UI for migration controls beyond a lightweight upgrade notice

## Follow-Up PR

After this slice lands, the next status-focused PR should:

- remove the separate hard-coded application-status domain entirely
- align application status and case status around the configurable status namespace
- preserve only the truly coded semantics such as archival handling and completed or terminal behavior derived from configuration
- then revisit the split-write atomicity issue once the status and persistence boundaries are stable
