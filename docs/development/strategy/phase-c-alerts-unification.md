# Phase C: Alerts Storage Unification Strategy

## Executive Summary

Following the completion of **Phase B (Storage Normalization)**, the application is currently in a "Split Brain" state regarding Alert data. While `FileStorageService` (v2.0) now includes an `alerts` array in the normalized `data.json`, the `AlertsService` continues to read and write to a separate `alerts.json` file via `AlertsStorageService`.

This document outlines the strategy to unify these data sources, eliminating `alerts.json` and establishing `data.json` as the Single Source of Truth (SSoT).

## The Problem: "Split Brain" Storage

Currently, two competing sources of truth exist:

1.  **`alerts.json`**: Used by `AlertsService` for status updates (Resolved, Snoozed, etc.).
2.  **`data.json` (v2.0)**: Used by `FileStorageService` to hydrate `CaseDisplay` objects on application load.

**Risk Scenario:**

1.  User resolves an alert in the UI -> Updates `alerts.json`.
2.  User reloads the page -> `FileStorageService` reads `data.json` (which contains stale alert data).
3.  **Result:** The alert reverts to "New", and the user's work is lost in the runtime session.
4.  **Compounding:** If the user then saves a case note, `FileStorageService` writes the _stale_ alert data back to `data.json`, permanently overwriting the correct state.

## Objectives

1.  **Eliminate `alerts.json`**: Migrate all existing workflow states (resolution notes, status) into `data.json`.
2.  **Pure Logic Layer**: Refactor `AlertsService` to be stateless, operating only on data passed to it.
3.  **Unified I/O**: Centralize all file operations in `FileStorageService` via `DataManager`.

## Implementation Plan

### Step 0: Preparation (Logic Extraction)

Before deleting `AlertsStorageService`, we must preserve its logic for the migration.

- **Extract Parsing Logic:** Move `hydrateStoredAlert`, `parseStoredAlertsPayload`, and `normalizeStoredAlertEntry` from `AlertsStorageService` into a standalone utility (e.g., `utils/alerts/alertMigrationUtils.ts`).
- **Verify Tombstone Capability:** Confirm `AutosaveFileService` can overwrite `alerts.json` with a small JSON object to mark it as migrated.

### Step 1: Migration Logic (FileStorageService)

Modify `FileStorageService.readFileData()` to perform a one-time migration:

- **Check:** Does `alerts.json` exist?
- **Read:** Load `alerts.json` content.
- **Tombstone Check:** If content contains `{ "migrated": true }`, skip migration.
- **Hydrate:** Use the extracted utility to parse the legacy alerts.
- **Merge:**
  - **If Normalized (v2.0):** Merge hydrated alerts into the root `alerts` array.
  - **If Legacy:** Map hydrated alerts into the nested `case.alerts` arrays (requires matching logic).
- **Tombstone:** Overwrite `alerts.json` with `{ "migrated": true, "migratedAt": "..." }` to prevent future reads.
- **Persist:** Immediately save the merged state to `data.json`.

### Step 2: Refactor AlertsService

Remove `AlertsStorageService` dependency from `AlertsService` and make it a pure logic library.

- **Current:** `constructor(storage: AlertsStorageService)`
- **New:** `constructor()` (Stateless)
- **Method Changes:**
  - `getAlertsIndex(cases)` -> `getAlertsIndex(alerts, cases)`
  - `updateAlertStatus(...)` -> Returns the updated alert object; does _not_ write to disk.
  - `mergeAlertsFromCsv(...)` -> Returns the merged alerts array; does _not_ write to disk.

### Step 3: Update DataManager Orchestration

Update `DataManager` to handle the I/O and data flow.

- **Read:** `getAllCases()` loads data via `FileStorageService`.
- **Extract:** `DataManager` extracts alerts from the loaded cases (or normalized structure) to pass to `AlertsService`.
  ```typescript
  const cases = await this.fileStorage.readFileData();
  const allAlerts = cases.flatMap((c) => c.alerts ?? []);
  const index = this.alertsService.getAlertsIndex(allAlerts, cases);
  ```
- **Write:** When `AlertsService` returns an updated alert or merged list, `DataManager` updates the in-memory model and calls `FileStorageService.writeFileData()`.

### Step 4: Cleanup

- Delete `utils/services/AlertsStorageService.ts`.
- Remove `alerts.json` from `AutosaveFileService` allowlist (optional, but good for hygiene).

## Technical Complexity

- **Complexity:** Low/Medium
- **Estimated Time:** 2-3 Hours
- **Risk:** Low (Migration logic is standard; existing merge logic in `AlertsService` can be reused).

## Success Metrics

- [ ] `alerts.json` is no longer generated or read.
- [ ] Alert status updates persist across page reloads via `data.json`.
- [ ] `AlertsService` has 0 dependencies on file I/O.
