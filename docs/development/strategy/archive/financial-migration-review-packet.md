# Financial Domain Migration: Strategy Review Packet

**Date:** November 19, 2025
**Status:** Phase D, Step 1 Complete (Use Cases Implemented)
**Target Audience:** Senior Architect / Second Opinion LLM

## 1. Executive Summary & Context

We are refactoring a legacy "Local-First" CMS application. The original architecture relied on a monolithic `DataManager` class (2,700+ lines) that read/wrote a massive `data.json` file for every operation. This caused performance issues, race conditions, and high coupling.

**The Goal:** Migrate to a **Clean Architecture** (Domain-Driven Design) with:

1.  **Domain Layer:** Pure business logic entities and Use Cases.
2.  **Application Layer:** Services and State Management (`ApplicationState`).
3.  **Infrastructure Layer:** Repositories handling file I/O.

**The History (Risk Factor):**
A previous attempt to migrate _all_ domains (Cases, Financials, Notes) simultaneously failed ("The Irreparable Breakdown"). It introduced a "Split Brain" problem where the storage format (Legacy vs. Normalized) became inconsistent, leading to data loss. We reverted that change.

**The Current Strategy:**
We are now using a **"Strangler Fig" / Incremental approach**.

1.  **Phase A (Complete):** We extracted the monolithic `DataManager` into 7 smaller, single-responsibility services (e.g., `FinancialsService`, `AlertsService`). This stabilized the legacy code.
2.  **Phase B (Complete):** We normalized the storage format (v2.0) to support relational data (Cases, Financials, Notes as separate lists) while maintaining backward compatibility.
3.  **Phase C (Complete):** We unified the Alerts system.
4.  **Phase D (Current):** We are migrating **ONLY the Financials Domain** to the new architecture.

---

## 2. The Proposed Architecture for Financials

We are treating `FinancialItem` as a **Child Entity** of a `Case` (Aggregate Root), but managing it independently for performance.

### A. The Domain Layer (Implemented)

We have implemented 4 Use Cases in `domain/financials/useCases/`:

1.  `CreateFinancialItem`: Creates item, touches parent Case timestamp, saves both in transaction.
2.  `UpdateFinancialItem`: Validates ownership, updates item (immutable), touches parent Case, saves both.
3.  `DeleteFinancialItem`: Removes item, touches parent Case, saves.
4.  `GetFinancialItems`: Retrieves items by Case ID.

**Key Pattern:**

```typescript
// UpdateFinancialItem.ts
const updatedItem = existingItem.applyUpdates({ amount: 100 });
parentCase.touch(); // Updates parent's updatedAt

await this.transactionRepository.runTransaction([
  { type: "save", domain: "financials", entity: updatedItem },
  { type: "save", domain: "cases", entity: parentCase },
]);
```

### B. The Application Layer (Next Step)

We plan to implement a `FinancialManagementService` (Adapter) that acts as the bridge between the UI and the Domain.

**Responsibilities:**

1.  **Orchestration:** Call the appropriate Use Case.
2.  **State Management:** Update the in-memory `ApplicationState` immediately (Optimistic UI).
3.  **Feedback:** Trigger UI toasts (Loading -> Success/Error).
4.  **Error Handling:** Rollback `ApplicationState` if the file write fails.

### C. The Infrastructure Layer (Refactored)

We use a file-based `StorageRepository` that implements `ITransactionRepository`.

**CRITICAL UPDATE (Nov 19):**
We have refactored `StorageRepository` to inject `FileStorageService` instead of the raw `AutosaveFileService`.

- **Old Way (Risk):** `StorageRepository` -> `AutosaveFileService` (Bypassed normalization logic).
- **New Way (Safe):** `StorageRepository` -> `FileStorageService` -> `AutosaveFileService`.

This ensures that both the Legacy `DataManager` and the new Domain Repositories go through the exact same "Gatekeeper" logic for migration, normalization (v2.0), and persistence.

---

## 3. Specific Questions for Review

Please review this strategy with a critical eye on **Data Integrity** and **Complexity**.

### Q1: The "Child Entity" Consistency Problem

**Context:** We are updating `FinancialItem` independently, but we _must_ update the parent `Case.updatedAt` timestamp so the UI knows the Case has changed.
**Strategy:** We include the `parentCase` in the transaction explicitly (`parentCase.touch()`).
**Risk:** Is there a risk that `parentCase` in memory is stale when we fetch it?
**Mitigation:** The `ICaseRepository.getById()` always fetches the latest version from the `ApplicationState` (memory) or falls back to storage.

### Q2: State Synchronization (Dual Write)

**Context:** The `FinancialManagementService` will update `ApplicationState` (Memory) AND call the Use Case (which writes to File).
**Strategy:**

1.  User clicks "Save".
2.  Service updates `ApplicationState` (UI updates instantly).
3.  Service calls Use Case -> Repository -> File Write.
4.  If File Write fails, Service reverts `ApplicationState`.
    **Question:** Is this "Optimistic UI" pattern safe enough for a local-first app, or should we wait for the File Write to complete before updating State? (Waiting causes UI lag).

### Q3: The "Split Brain" Risk (Addressed)

**Context:** The legacy `DataManager` (used by other domains) still reads/writes `data.json`. The new `Financials` domain also reads/writes `data.json`.
**Update:** We have addressed the "Bypass" risk by rewiring `StorageRepository` to use `FileStorageService`.
**Question:** Are there any remaining edge cases where `FileStorageService` might behave differently when called from `DataManager` (Legacy) vs. `StorageRepository` (New)?

- _Note:_ `StorageRepository` manually flattens the denormalized data returned by `FileStorageService` to populate its internal lists.

### Q4: Over-Engineering?

**Context:** We are building Entities, Use Cases, Repositories, and Services for simple CRUD.
**Justification:** We need this structure to handle complex validation and cross-domain logic (e.g., "If Financial Item > $10k, trigger an Alert") in the future.
**Question:** Is this too much boilerplate for the current stage?

---

## 4. Implementation Plan (Phase D)

1.  **Step 1 (Done):** Implement Domain Use Cases.
2.  **Step 2 (Done):** Implement `FinancialManagementService` (Adapter).
3.  **Step 3 (Done):** Create `useFinancialManagement` Hook.
4.  **Step 4 (Done):** Replace `useFinancialItems` in UI components (Updated `useFinancialItemFlow` to support dual-mode).
5.  **Step 5 (Ready for Verification):** Verify Feature Flag toggle (`USE_FINANCIALS_DOMAIN`).

**Update (Nov 19):**

- Fixed `StorageRepository` bug where financial items were lost during save if they were processed before their parent case was created in the test environment.
- Fixed `StorageRepository` bug where `category` property was stripped from financial items during flattening, causing them to be dropped during subsequent saves.
- Updated `StorageRepository` tests to correctly mock `readNamedFile` and match the actual behavior of `FileStorageService` (metadata/payload enrichment).
- Verified that `__tests__/infrastructure/StorageRepository.test.ts` and `__tests__/integration/FinancialMigration.test.ts` pass.

## 5. Request for Second Opinion

Please evaluate if this incremental strategy effectively mitigates the risk of the previous "Irreparable Breakdown." specifically focusing on the interaction between the new Domain layer and the existing Legacy layer.
