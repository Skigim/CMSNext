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

### Step 1: Migration Logic (FileStorageService)

Modify `FileStorageService.readFileData()` to perform a one-time migration:

- **Check:** Does `alerts.json` exist?
- **Read:** Load `alerts.json` content.
- **Merge:** Apply `alerts.json` workflow states (status, resolution notes) onto the v2.0 `alerts` array loaded from `data.json`.
- **Archive:** Rename `alerts.json` to `alerts.json.migrated` (or delete) to prevent future reads.
- **Persist:** Immediately save the merged state to `data.json`.

### Step 2: Refactor AlertsService

Remove `AlertsStorageService` dependency from `AlertsService`.

- **Current:** `constructor(storage: AlertsStorageService)`
- **New:** `constructor()` (Stateless)
- **Method Changes:**
  - `getAlertsIndex(cases)` -> `getAlertsIndex(alerts, cases)`
  - `updateAlertStatus(...)` -> Returns the updated alert object; does _not_ write to disk.
  - `mergeAlertsFromCsv(...)` -> Returns the merged alerts array; does _not_ write to disk.

### Step 3: Update DataManager Orchestration

Update `DataManager` to handle the I/O that `AlertsService` used to do.

- **Read:** `getAllCases()` already loads alerts via `FileStorageService`.
- **Write:** When `AlertsService` returns an updated alert or merged list, `DataManager` calls `FileStorageService.writeFileData()`.

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
