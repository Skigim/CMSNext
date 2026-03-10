# v2.1 Storage Backend Design Document

**Status:** Draft — for review  
**Created:** March 10, 2026  
**Roadmap reference:** [ROADMAP_MAR_2026.md](./ROADMAP_MAR_2026.md) — Weeks 2 & 3  
**Author:** GitHub Copilot

---

## 1. Purpose

This document specifies the design for the v2.1 storage schema and the services and data-layer changes needed to implement it.  It is a **pre-implementation review artifact**; no code changes are included.

The goal is to reach agreement on:

- Exactly what the v2.1 `NormalizedFileData` shape looks like
- How `Person` entities are extracted from cases and stored globally
- How `DataManager` and `CaseService` hydrate/dehydrate at runtime
- What `PersonService` owns
- How the v2.0 → v2.1 migration runs
- Which risks need mitigation before coding starts

---

## 2. Problem Statement / Current-State Limitations

### 2.1 Embedded people

`StoredCase` today carries a full `Person` object inline via its `CaseDisplay` base:

```typescript
// Current v2.0 — person is embedded inside each case
interface StoredCase extends Omit<CaseDisplay, "caseRecord" | "alerts"> {
  caseRecord: Omit<CaseRecord, "financials" | "notes">;
}

interface CaseDisplay {
  // ...
  person: Person;   // ← full object, not a reference
  // ...
}
```

**Consequences:**

| Problem | Impact |
|---|---|
| Same physical person can exist as separate, divergent copies across cases | Stale/inconsistent contact info; no single source of truth |
| Updating a person requires finding every case they appear in | O(n) writes, fragile, error-prone |
| Household/family relationships (`familyMembers`, `relationships`) point at names or opaque IDs that are never enforced | Dangling references, no relational integrity |
| Cannot display a "person profile" page that aggregates all cases for one individual | Architecture blocks the feature entirely |
| `authorizedRepIds` stores IDs but the corresponding rep records have nowhere to live globally | Feature is effectively unusable |

### 2.2 Relationship model is incomplete

`Relationship` today stores a display `name` and a `phone` string — not a `personId`:

```typescript
interface Relationship {
  id?: string;
  type: string;
  name: string;   // free text, not a foreign key
  phone: string;
}
```

This means relationship targets cannot be looked up, validated, or kept in sync.

---

## 3. Goals and Non-Goals

### Goals

1. Extract `Person` from every `StoredCase` into a single root-level `people: Person[]` array.
2. Cases store only a typed reference (`personId`) to link back to a `Person`.
3. `Relationship` records inside `Person` link to other `Person` entries by `personId`.
4. `DataManager` / `CaseService` hydrate a full `CaseDisplay` (with the resolved `Person`) at read time.
5. Write path dehydrates back to normalized form (ID refs only).
6. A new `PersonService` owns all person CRUD and case-linking operations.
7. A pure migration function converts any v2.0 file to v2.1 losslessly.
8. Archive files (same v2.0 schema) are handled explicitly — either migrated on load or kept separate.

### Non-Goals (this iteration)

- Multi-user collaboration or server sync
- Merging duplicate person records automatically (conservative approach; see §9)
- Changing the UI components beyond what is minimally required for the data shape change (Week 4 task)
- Full-text search or indexing across people

---

## 4. Proposed v2.1 Storage Model

### 4.1 Overview

```
NormalizedFileData v2.1
├── version: "2.1"
├── people: Person[]          ← NEW root-level global array
├── cases: StoredCase[]       ← personId replaces embedded Person
├── financials: StoredFinancialItem[]
├── notes: StoredNote[]
├── alerts: AlertRecord[]
├── categoryConfig: CategoryConfig
├── activityLog: CaseActivityEntry[]
├── templates?: Template[]
├── exported_at: string
└── total_cases: number
```

Storage is normalized (IDs only).  The UI always works with hydrated view models.

### 4.2 Invariants

- Every `StoredCase.personId` **must** reference an entry in `people[]`.
- Every `Person.relationships[].targetPersonId` **must** reference an entry in `people[]`, or be `null` when the related person has not yet been recorded.
- A `Person` record may exist without being linked to any case (standalone contact).
- Deleting a case does **not** delete its `Person`; person deletion is an explicit, guarded operation.
- `Person.id` is immutable once created; never reassigned during migration or updates.

---

## 5. TypeScript Interface Sketches

> These are design proposals, not final code.  Names, field optionality, and comments are subject to change during implementation review.

### 5.1 `NormalizedFileData` v2.1

```typescript
export interface NormalizedFileData {
  /** Data format version — bump to "2.1" */
  version: "2.1";
  /** Global registry of all person entities — normalized, no case data embedded */
  people: Person[];
  /** Flat array of cases; each case links to a Person by personId */
  cases: StoredCase[];
  financials: StoredFinancialItem[];
  notes: StoredNote[];
  alerts: AlertRecord[];
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
  activityLog: CaseActivityEntry[];
  templates?: Template[];
}
```

### 5.2 `Person` v2.1

```typescript
export interface Person {
  /** Stable UUID; never reassigned */
  id: string;
  firstName: string;
  lastName: string;
  /**
   * Display name.  Currently stored; open question §11.2 proposes computing
   * this as `${firstName} ${lastName}` at hydration time and removing it from
   * the persisted schema.  Decision pending review.
   */
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  /** Stored encrypted at-rest; never logged */
  ssn: string;
  organizationId: string | null;
  livingArrangement: string;
  address: Address;
  mailingAddress: MailingAddress;
  /** IDs of authorized representative Person records */
  authorizedRepIds: string[];
  /** IDs of household member Person records */
  familyMemberIds: string[];          // renamed from familyMembers (string[] — values were intended to be person IDs but were not validated as such)
  /** Typed relational links to other Person records */
  relationships: PersonRelationship[];
  status: string;
  createdAt: string;
  updatedAt: string;
  dateAdded: string;
}
```

**Migration note:** `familyMembers` → `familyMemberIds` is a rename.  During migration the existing string values should be treated as person IDs if they look like UUIDs, or discarded with a warning if they are free-text names with no matching person record.

### 5.3 `PersonRelationship` — typed, ID-based

```typescript
export type RelationshipType =
  | "spouse"
  | "domestic_partner"
  | "dependent"
  | "guardian"
  | "authorized_rep"
  | "sibling"
  | "parent"
  | "other";

export interface PersonRelationship {
  /** Stable UUID for this relationship record */
  id: string;
  type: RelationshipType;
  /**
   * ID of the related Person in the global people array.
   * null when the related person has not yet been entered into the system.
   */
  targetPersonId: string | null;
  /**
   * Free-text fallback label used only when targetPersonId is null.
   * Must not be used as a lookup key.
   */
  displayNameFallback?: string;
}
```

> **Decision point (open question §11.1):** Should relationships be stored symmetrically (both sides) or only on the initiating person?

### 5.4 `StoredCase` v2.1 — case-to-person reference

```typescript
export interface StoredCase {
  id: string;
  caseNumber: string;
  status: string;
  /** Links this case to a Person in the global people array */
  personId: string;                   // replaces embedded Person object
  caseRecord: Omit<CaseRecord, "financials" | "notes">;
  priority: boolean;
  createdAt: string;
  updatedAt: string;
  pendingArchival?: boolean;
}
```

### 5.5 `CaseDisplay` — hydrated runtime model (unchanged shape, new source)

`CaseDisplay` stays the same shape as today so that all existing UI components compile without changes.  The difference is that `person` is resolved at read time by `CaseService.hydrate()` rather than stored on disk.

```typescript
// No change to interface shape — this is the runtime/UI view model
export interface CaseDisplay {
  id: string;
  caseNumber: string;
  status: string;
  person: Person;       // populated by hydration, not from disk
  caseRecord: CaseRecord;
  priority: boolean;
  createdAt: string;
  updatedAt: string;
  alerts?: AlertRecord[];
}
```

---

## 6. Migration Strategy: v2.0 → v2.1

### 6.1 Principles

- Migration is a **pure function**: `(NormalizedFileData_v20) => NormalizedFileData_v21`.
- It is idempotent: running it twice on the same input produces the same output.
- It is **lossless**: every field present in v2.0 survives in v2.1.
- It never modifies the source file in-place; the caller decides whether to write back.
- Migration runs **lazily on file open** — not eagerly on app start.

### 6.2 Migration algorithm

```
function migrateV20ToV21(v20: NormalizedFileData_v20): NormalizedFileData_v21
  1. Collect every embedded person from v20.cases[].person
  2. For each person:
       a. If person.id already exists in seen_ids → reuse; record that this
          case and the earlier case share the same person.
       b. If person.id is absent or empty → generate a new UUID and assign it.
       c. Merge into global people[] array (deduplicate by id only — see §9.3).
  3. Rewrite each case:
       a. Replace inline person with personId = person.id
       b. Preserve all other case fields unchanged
  4. Normalize relationships inside each Person:
       a. Convert legacy Relationship.name entries: if a Person with matching
          name exists in people[], set targetPersonId; else set targetPersonId = null
          and copy name → displayNameFallback
       b. Rename familyMembers → familyMemberIds; apply same UUID check
  5. Set version = "2.1"
  6. Return new object (do not mutate input)
```

### 6.3 Migration module location

```
utils/migration/
├── migrateV20ToV21.ts    # pure migration function
├── migrationTypes.ts     # input/output type aliases
└── index.ts              # re-exports
```

### 6.4 Where migration is triggered

`FileStorageService.readFileData()` currently checks the version field:

```typescript
// Proposed change (Week 2)
if (isNormalizedFileData_v20(rawData)) {
  const migrated = migrateV20ToV21(rawData);
  // write migrated data back to disk so next open is already v2.1
  await this.writeNormalizedData(migrated);
  return migrated;
}
```

Migration is applied **on first read** of a v2.0 file and written back immediately so the file is not migrated twice.

### 6.5 Archive file compatibility

Archived cases (`*.archive.json`, if any) use the same schema.  Options:

| Option | Tradeoff |
|---|---|
| **A — Migrate archive on load** | Simple; archives become v2.1 immediately; risk of touching old files |
| **B — Keep archives on v2.0; adapt readers** | Safer but requires dual-schema support forever |
| **C — Bulk-migrate all archives on first app open post-upgrade** | One-shot; needs progress feedback for large datasets |

**Recommendation:** Option A (migrate on load) — consistent with the lazy-read approach already used for the main file.  Archive files are opened infrequently, so migration cost is low.

---

## 7. Hydration / Dehydration Strategy

### 7.1 Vocabulary

| Term | Meaning |
|---|---|
| **Normalized (stored)** | `StoredCase` with `personId: string` — what lives on disk |
| **Hydrated (runtime)** | `CaseDisplay` with `person: Person` — what the UI uses |
| **Hydrate** | Resolve `personId` → full `Person` object at read time |
| **Dehydrate** | Replace full `Person` back to `personId` at write time |

### 7.2 Hydration in `CaseService`

```typescript
// Proposed addition to CaseService
hydrate(storedCase: StoredCase, people: Person[]): CaseDisplay {
  const person = people.find(p => p.id === storedCase.personId);
  if (!person) {
    throw new DataIntegrityError(
      `Person ${storedCase.personId} not found for case ${storedCase.id}`
    );
  }
  return {
    ...storedCase,
    person,
    caseRecord: { ...storedCase.caseRecord, financials: emptyFinancials, notes: [] },
  };
}

hydrateAll(storedCases: StoredCase[], people: Person[]): CaseDisplay[] {
  return storedCases.map(c => this.hydrate(c, people));
}
```

### 7.3 Dehydration in `CaseService`

```typescript
// Proposed addition to CaseService
dehydrate(display: CaseDisplay): StoredCase {
  const { person, caseRecord, alerts: _alerts, ...rest } = display;
  return {
    ...rest,
    personId: person.id,
    caseRecord: { ...caseRecord },
  };
}
```

### 7.4 `DataManager` integration

`DataManager` methods that currently return `StoredCase[]` should return `CaseDisplay[]` after hydration.  Methods that accept user input and write to disk call `CaseService.dehydrate()` before persisting.

Key touch points:

| DataManager method | Change |
|---|---|
| `getCases()` | call `hydrateAll` after read |
| `getCaseById()` | call `hydrate` after read |
| `createCase()` | accept `CaseDisplay`; call `dehydrate`; ensure person exists in `people[]` |
| `updateCase()` | call `dehydrate`; never touch `people[]` unless `PersonService.updatePerson()` is also called |
| `deleteCase()` | remove case; **do not** remove person (person may have other cases) |
| `getCasesForPerson()` | new — returns all cases linked to a given personId |

### 7.5 Performance note

People are read once per DataManager operation call (from the same in-memory read of the file).  Because DataManager is stateless and re-reads the file for every operation, hydration is a cheap in-memory `Array.find()`.  No caching layer is needed for v2.1.  If people arrays grow very large (>10,000 entries), consider a `Map<string, Person>` index inside the operation scope.

---

## 8. `PersonService` — Responsibilities and API

### 8.1 Responsibilities

- All CRUD operations for `Person` records
- Linking and unlinking persons to/from cases
- Managing relationships between persons
- Enforcing integrity constraints before mutations

`PersonService` is **stateless**, injected with `FileStorageService`, following the pattern of all existing services.

### 8.2 Constructor

```typescript
export class PersonService {
  private fileService: FileStorageService;

  constructor(fileService: FileStorageService) {
    this.fileService = fileService;
  }
}
```

### 8.3 Proposed public API

```typescript
// ── Read ──────────────────────────────────────────────────────────────
getPersonById(personId: string): Promise<Person>
getAllPeople(): Promise<Person[]>
getPeopleForCase(caseId: string): Promise<Person[]>
searchPeople(query: string): Promise<Person[]>   // name / phone / email prefix match

// ── Write ─────────────────────────────────────────────────────────────
createPerson(data: NewPersonData): Promise<Person>
updatePerson(personId: string, patch: Partial<NewPersonData>): Promise<Person>

/**
 * Delete a person.
 * Throws PersonLinkedToCaseError if the person is still referenced by any case.
 * Caller must unlink from all cases first, or use forceDelete.
 */
deletePerson(personId: string, options?: { forceDelete?: boolean }): Promise<void>

// ── Case linking ───────────────────────────────────────────────────────
linkPersonToCase(personId: string, caseId: string): Promise<void>
unlinkPersonFromCase(personId: string, caseId: string): Promise<void>
getCasesForPerson(personId: string): Promise<StoredCase[]>

// ── Relationships ──────────────────────────────────────────────────────
addRelationship(personId: string, rel: Omit<PersonRelationship, "id">): Promise<Person>
updateRelationship(personId: string, relId: string, patch: Partial<PersonRelationship>): Promise<Person>
removeRelationship(personId: string, relId: string): Promise<Person>
```

### 8.4 `NewPersonData` type

```typescript
export type NewPersonData = Omit<Person, "id" | "createdAt" | "updatedAt">;
```

### 8.5 Custom errors

```typescript
export class PersonNotFoundError extends Error { /* ... */ }
export class PersonLinkedToCaseError extends Error {
  constructor(personId: string, linkedCaseIds: string[]) { /* ... */ }
}
export class DataIntegrityError extends Error { /* ... */ }
```

### 8.6 Registration in `DataManager`

```typescript
// DataManager constructor
this.personService = new PersonService(this.fileStorageService);
```

Expose via `DataManager.people` property (matching the pattern for `this.cases`, `this.financials`, etc.) or proxy individual methods directly on `DataManager`.

---

## 9. Data Integrity Rules and Edge Cases

### 9.1 Foreign key enforcement

| Constraint | Enforcement point |
|---|---|
| `StoredCase.personId` must exist in `people[]` | `CaseService.hydrate()` throws `DataIntegrityError`; `FileStorageService.writeNormalizedData()` runs a pre-write integrity check |
| `PersonRelationship.targetPersonId` must exist in `people[]` or be `null` | `PersonService.addRelationship()` validates before write |
| `Person.authorizedRepIds[]` members must exist in `people[]` | `PersonService.updatePerson()` validates; orphan IDs are removed with a logged warning |
| `Person.familyMemberIds[]` members must exist in `people[]` | Same as above |

### 9.2 Orphan person detection

A periodic integrity sweep (opt-in; not on every save) should:

1. Collect all `personId` values referenced by cases.
2. Report persons in `people[]` with zero case links.
3. Never auto-delete orphans — surface as warnings only.

### 9.3 Deduplication ambiguity

Automatic person merging is **not** in scope for v2.1.  The migration takes a conservative approach:

- **Same `id`** → same person; no merge conflict.
- **Same name + same DOB, different IDs** → keep separate; emit a structured warning for human review.
- **Missing ID** → generate a new UUID; never guess identity.

Rationale: incorrect auto-merges cause data loss that is very hard to recover from in a local-first, file-based system with no transaction log.

### 9.4 Relationship cycles

A person should not list themselves in `relationships[]`, `authorizedRepIds`, or `familyMemberIds`.  `PersonService` validates `targetPersonId !== personId` on every write.

Circular chains (A → B → A) are allowed for symmetric relationships (e.g., spouses).  Infinite loops are impossible since the structure is non-recursive in the stored format.

### 9.5 Partial persons (created during migration)

If a case embeds a `Person` object with missing required fields (e.g., no `id`, blank `firstName`), the migration should:

1. Assign a generated ID.
2. Log a structured warning with the case ID and missing fields.
3. Store the partial record as-is — do not silently discard it.

Migration warnings are written to `activityLog` (see §11.7) so they are visible in the app's activity history without polluting the `Person` schema with metadata fields.

### 9.6 SSN handling

`Person.ssn` is sensitive.  It must **never** appear in:

- `activityLog` entries
- Error messages or toast text
- Console output (including logger calls)

Encryption of `ssn` at-rest is already handled by the existing AES-256-GCM encryption layer.  `PersonService` must not log or return the SSN in error messages.

---

## 10. Testing Strategy

### 10.1 Unit test scope

| Unit | What to test | Test location |
|---|---|---|
| `migrateV20ToV21` | Happy path; duplicate persons; missing IDs; partial persons; idempotency | `__tests__/utils/migration/migrateV20ToV21.test.ts` |
| `PersonService.createPerson` | Creates record; generates ID; timestamps correct | `__tests__/services/PersonService.test.ts` |
| `PersonService.deletePerson` | Blocks when linked to case; succeeds when unlinked; forceDelete removes links | same |
| `PersonService.addRelationship` | Validates targetPersonId; prevents self-link; returns updated Person | same |
| `CaseService.hydrate` | Resolves correct Person; throws on missing personId | `__tests__/services/CaseService.test.ts` |
| `CaseService.dehydrate` | Strips Person to personId; no mutation | same |
| `FileStorageService` integrity check | Pre-write check catches broken personId refs | `__tests__/services/FileStorageService.test.ts` |

### 10.2 Migration test matrix

| Scenario | Expected outcome |
|---|---|
| Single case with a valid Person (has id) | Person extracted to `people[]`; case gains `personId`; version = "2.1" |
| Two cases sharing the same person.id | Single Person in `people[]`; both cases reference it |
| Person with no id | New UUID assigned; warning logged; person added to `people[]` |
| Person with all blank fields | Partial record created with generated ID; migration warning written to `activityLog` |
| Case with `Relationship` entries (name-based) | Name resolved to matching Person if possible; else `targetPersonId = null`, `displayNameFallback` set |
| `familyMembers` containing UUID strings | Renamed to `familyMemberIds`; validated against `people[]` |
| `familyMembers` containing free-text names | Set to `[]`; warnings logged with original values |
| Already-migrated v2.1 file passed to migration | Returns input unchanged (idempotency) |
| File with missing `people` property | Treated as v2.0; migration runs |
| Archive file with v2.0 schema | Migrated identically to main file |

### 10.3 Integration test scope

- Open a v2.0 file → app triggers migration → file is v2.1 on disk after save.
- Create a case → `PersonService.createPerson` called → person appears in `people[]`.
- Update a person → all cases hydrate with updated person data on next read.
- Delete a case → `people[]` unchanged.

### 10.4 Performance test

- Generate a dataset of 500 cases, each with a unique person.
- Time `hydrateAll()` and assert < 50 ms (linear scan; well within threshold).
- If needed, profile `Map<string, Person>` index vs. `Array.find()`.

### 10.5 Mocking pattern

Follow the existing service test pattern — mock `FileStorageService` with typed `vi.fn()`:

```typescript
const mockFileService = {
  read: vi.fn<[], Promise<NormalizedFileData>>(),
  writeNormalizedData: vi.fn<[NormalizedFileData], Promise<NormalizedFileData>>(),
};
const service = new PersonService(mockFileService as unknown as FileStorageService);
```

---

## 11. Open Questions / Review Checklist

### 11.1 Relationship symmetry
- **Q:** Should `PersonRelationship` be stored on both sides (A → B and B → A), or only on the initiating person?
- **Tradeoff:** Symmetric is convenient for reads; requires two writes and sync logic on updates.  One-directional is simpler to implement and migrate.
- **Recommendation (proposed):** One-directional for v2.1; symmetric can be added in v2.2 with a migration.

### 11.2 `name` field on `Person`
- **Q:** Should `Person.name` remain a stored field (currently `name: string`) or be computed as `${firstName} ${lastName}` at hydration time?
- **Recommendation (proposed):** Compute at hydration; remove from stored schema to avoid divergence.

### 11.3 `familyMembers` rename
- **Q:** Is renaming `familyMembers` → `familyMemberIds` acceptable, or should both fields be kept (old + new) during a transition period?
- **Recommendation (proposed):** Clean rename in the migration; no dual-field period.

### 11.4 PersonService vs DataManager proxy
- **Q:** Should `PersonService` methods be called directly (via `useDataManager().personService.createPerson(...)`) or proxied as top-level methods on `DataManager` (like existing case/financial methods)?
- **Recommendation (proposed):** Proxy on `DataManager` for consistency with the existing API surface.

### 11.5 Version string type
- **Q:** Should `NormalizedFileData.version` use a discriminated union (`"2.0" | "2.1"`) or a free-form string?
- **Recommendation (proposed):** Keep discriminated union; update the `isNormalizedFileData` type guard to accept `"2.1"`.

### 11.6 Error handling for orphaned `personId`
- **Q:** If a case references a `personId` that is not in `people[]` (data corruption), should the app throw, warn, or silently skip?
- **Recommendation (proposed):** Throw `DataIntegrityError` in strict mode; log a warning and return a placeholder person in lenient/migration mode.

### 11.7 `_migrationWarning` field
- **Q:** Is a metadata flag on `Person` the right place to surface migration warnings, or should warnings be written to `activityLog` instead?
- **Recommendation (proposed):** Write to `activityLog` (more visible, no schema pollution); skip the `_migrationWarning` field.

---

## 12. Phased Implementation Plan

This plan maps directly to the March 2026 roadmap weeks.

### Week 2 (March 9–15): Data Model & Storage Refactoring

**Prep**
- [ ] Finalize review of this design doc; record decisions on §11 open questions.
- [ ] Inventory all TypeScript files that import `Person`, `StoredCase`, or `CaseDisplay`; produce a checklist of files that need updating.
- [ ] Diagram the hydration callgraph through `DataManager` (which methods call read? which call write?).

**Implementation**
- [ ] Add `PersonRelationship` and `PersonLinkedToCaseError` types; update `Person` interface for v2.1.
- [ ] Update `NormalizedFileData` to v2.1 shape (add `people: Person[]`; bump version literal).
- [ ] Update `isNormalizedFileData` type guard.
- [ ] Implement `utils/migration/migrateV20ToV21.ts` (pure function; no I/O).
- [ ] Wire migration into `FileStorageService.readFileData()`.
- [ ] Implement `PersonService` with full API (§8.3).
- [ ] Register `PersonService` in `DataManager`.

**Tests**
- [ ] Unit tests for `migrateV20ToV21` covering the full test matrix (§10.2).
- [ ] Unit tests for `PersonService` (§10.1).

### Week 3 (March 16–22): Hydration & Service Layer Updates

**Prep**
- [ ] Run `npm run typecheck` to surface all TypeScript errors caused by the `StoredCase` shape change; triage each one.
- [ ] List all UI components that access `caseDisplay.person` directly.

**Implementation**
- [ ] Add `CaseService.hydrate()` and `CaseService.dehydrate()`.
- [ ] Update `DataManager` read methods to call `hydrateAll` before returning.
- [ ] Update `DataManager` write methods to call `dehydrate` before persisting.
- [ ] Update `domain/cases/` formatting utilities that assume embedded `Person`.
- [ ] Enable `PersonRelationship` relational linking (§5.3).
- [ ] Pre-write integrity check in `FileStorageService.writeNormalizedData()`.

**Tests**
- [ ] Unit tests for `CaseService.hydrate` / `dehydrate` (§10.1).
- [ ] Integration test: v2.0 file open → auto-migrated → v2.1 on disk.
- [ ] Performance test: 500-case hydration < 50 ms (§10.4).
- [ ] Ensure all existing 1141+ tests pass with zero regressions.

### Week 4 (March 23–31): UI & Workflow Overhaul

*(Out of scope for this design doc; tracked in ROADMAP_MAR_2026.md Week 4)*

---

## Appendix A: Before/After JSON Example

### v2.0 (current)

```json
{
  "version": "2.0",
  "cases": [
    {
      "id": "case-001",
      "caseNumber": "2025-0042",
      "status": "Active",
      "person": {
        "id": "person-abc",
        "firstName": "Jane",
        "lastName": "Doe",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "555-0100",
        "dateOfBirth": "1985-06-15",
        "ssn": "[encrypted]",
        "relationships": [
          { "id": "rel-1", "type": "spouse", "name": "John Doe", "phone": "555-0101" }
        ],
        "familyMembers": ["person-xyz"],
        "authorizedRepIds": []
      },
      "caseRecord": { "applicationDate": "2025-01-10" }
    }
  ],
  "financials": [],
  "notes": [],
  "alerts": []
}
```

### v2.1 (proposed)

> **Note on `name` field:** The example below retains `name` to reflect the current `Person` type.
> Open question §11.2 proposes removing it in favour of computing `"${firstName} ${lastName}"` at hydration time.
> The decision is pending review.

```json
{
  "version": "2.1",
  "people": [
    {
      "id": "person-abc",
      "firstName": "Jane",
      "lastName": "Doe",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "555-0100",
      "dateOfBirth": "1985-06-15",
      "ssn": "[encrypted]",
      "relationships": [
        {
          "id": "rel-1",
          "type": "spouse",
          "targetPersonId": "person-jdoe",
          "displayNameFallback": null
        }
      ],
      "familyMemberIds": ["person-xyz"],
      "authorizedRepIds": [],
      "createdAt": "2025-01-10T09:00:00.000Z",
      "updatedAt": "2025-01-10T09:00:00.000Z",
      "dateAdded": "2025-01-10"
    },
    {
      "id": "person-jdoe",
      "firstName": "John",
      "lastName": "Doe",
      "name": "John Doe",
      "email": "",
      "phone": "555-0101",
      "dateOfBirth": "",
      "ssn": "",
      "relationships": [],
      "familyMemberIds": [],
      "authorizedRepIds": [],
      "createdAt": "2025-01-10T09:00:00.000Z",
      "updatedAt": "2025-01-10T09:00:00.000Z",
      "dateAdded": "2025-01-10"
    }
  ],
  "cases": [
    {
      "id": "case-001",
      "caseNumber": "2025-0042",
      "status": "Active",
      "personId": "person-abc",
      "caseRecord": { "applicationDate": "2025-01-10" }
    }
  ],
  "financials": [],
  "notes": [],
  "alerts": []
}
```

---

*End of document. Please add review comments or mark open questions in §11 as resolved before implementation begins.*
