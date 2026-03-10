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
2. Cases store one or more typed person references (`CasePersonRef[]`) instead of an embedded `Person` object.  Each reference carries a role and an `isPrimary` flag (exactly one per case must be `true`) so the primary applicant is always identifiable.
3. `Relationship` records inside `Person` link to other `Person` entries by `personId`.
4. `DataManager` / `CaseService` hydrate a full `CaseDisplay` — with the resolved primary `Person` (the linked person where `isPrimary: true`) and all linked people — at read time.
5. Write path dehydrates back to normalized form (ID refs only).
6. A new `PersonService` owns all person CRUD and case-linking operations.
7. A pure migration function converts any v2.0 file to v2.1 without discarding user data.
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
├── cases: StoredCase[]       ← people: CasePersonRef[] replaces embedded Person
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

- Every `personId` inside `StoredCase.people[].personId` **must** reference an entry in the root `people[]` array.
- Every `StoredCase.people[]` array **must** contain at least one entry.
- Exactly one `CasePersonRef` in each case's `people[]` **must** have `isPrimary: true`; the rest must have `isPrimary: false`.
- Every `Person.relationships[].targetPersonId` **must** reference an entry in `people[]`, or be `null` when the related person has not yet been recorded.
- A `Person` record may exist without being linked to any case (standalone contact).
- Deleting a case does **not** delete its linked `Person` records; person deletion is an explicit, guarded operation.
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
  /** Flat array of cases; each case links to persons via a people: CasePersonRef[] array */
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
  /**
   * Free-text family member names that could not be resolved to Person IDs
   * during v2.0 → v2.1 migration.  Preserved for manual review; not used for
   * lookups.
   */
  legacyFamilyMemberNames?: string[];
  /**
   * Typed relational links to other Person records.
   * Changed from optional (?) to required in v2.1; defaults to [] on migration.
   */
  relationships: PersonRelationship[];
  status: string;
  createdAt: string;
  /**
   * NEW in v2.1.  Not present on existing Person records.
   * Migration: set to createdAt value for records that pre-date v2.1.
   */
  updatedAt: string;
  dateAdded: string;
}
```

**Migration notes for `Person` changes:**

- `familyMembers` → `familyMemberIds`: During migration, existing string values are treated as person IDs if they pass UUID validation.  Values that are not valid UUIDs are **not discarded**; they are stored in `Person.legacyFamilyMemberNames[]` so no user data is lost.  A migration warning is written to `activityLog` for each case where this occurs.
- `relationships`: Was `optional` (`?`) in the current type; becomes **required** (non-optional) in v2.1 with a default of `[]`.  Migration sets it to `[]` when absent.
- `updatedAt`: **New field in v2.1**.  Not present on existing `Person` records stored in v2.0 files.  Migration sets `updatedAt` equal to `createdAt` for all pre-existing person records.

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
  /**
   * Phone number preserved from the legacy v2.0 Relationship.phone field during
   * migration.  Kept to ensure losslessness.  Once the related person record is
   * created and targetPersonId is set, this value should be reviewed and either
   * merged into that Person's phone field or cleared.
   */
  legacyPhone?: string;
}
```

> **Decision point (open question §11.1):** Should relationships be stored symmetrically (both sides) or only on the initiating person?

### 5.4 `CasePersonRef` and `StoredCase` v2.1 — multi-person case references

v2.1 removes the one-person-per-case restriction.  A case can now link to multiple people with typed roles (e.g., an applicant plus household members or dependents).

```typescript
export type CasePersonRole =
  | "applicant"
  | "household_member"
  | "dependent"
  | "contact";

export interface CasePersonRef {
  /** ID of the linked Person in the global people[] array */
  personId: string;
  role: CasePersonRole;
  /**
   * Exactly one entry per case must be true.
   * The person where isPrimary is true is the main applicant.
   */
  isPrimary: boolean;
}

export interface StoredCase {
  id: string;
  /**
   * Case display name/title.
   * Preserved from current StoredCase (inherited via CaseDisplay today).
   */
  name: string;
  /** Medicaid case number */
  mcn: string;
  status: CaseStatus;
  priority: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * All persons linked to this case.
   * Replaces the single embedded Person object from v2.0.
   * Must contain at least one entry; exactly one must have isPrimary: true.
   */
  people: CasePersonRef[];
  /**
   * NOTE (v2.1): Case-person relationships are authoritative via `people[]` above.
   * Any `personId` / `spouseId` fields that still exist on `CaseRecord` are
   * legacy, backward-compatibility data and MUST NOT be used as the source of
   * truth by new code.  A future migration (v2.2) may deprecate or remove these
   * fields from `CaseRecord` entirely.  See open question §11.8.
   */
  caseRecord: Omit<CaseRecord, "financials" | "notes">;
  pendingArchival?: boolean;
}
```

> **Note on inheritance:** In v2.0, `StoredCase extends Omit<CaseDisplay, "caseRecord" | "alerts">`.
> In v2.1, this inheritance relationship changes because `StoredCase` stores normalized person references
> while `CaseDisplay` carries hydrated `Person` objects.  The shared scalar fields (`id`, `name`, `mcn`,
> `status`, `priority`, `createdAt`, `updatedAt`) must be kept in sync between the two interfaces.

### 5.5 `CaseDisplay` — hydrated runtime model

`CaseDisplay` retains its existing scalar fields (`id`, `name`, `mcn`, `status`, `priority`, `createdAt`, `updatedAt`) unchanged so existing UI components continue to compile.  The difference is that `person` is now resolved from the primary `CasePersonRef` at read time by `CaseService.hydrate()`, and a new `linkedPeople` field exposes all linked persons for v2.1 household views.  `linkedPeople` is always populated by `hydrate()` so it is **required** (non-optional) on the runtime model.

```typescript
// Runtime/UI view model — not stored on disk
export interface CaseDisplay {
  id: string;
  /** Case display name/title — unchanged from v2.0 */
  name: string;
  /** Medicaid case number — unchanged from v2.0 */
  mcn: string;
  status: CaseStatus;
  priority: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Normalized person references — mirrors StoredCase.people and is included
   * here to allow dehydrate() to round-trip without requiring a separate input.
   */
  people: CasePersonRef[];
  /**
   * Primary applicant — resolved by hydration from the CasePersonRef where
   * isPrimary is true.  Not stored on disk.
   */
  person: Person;
  /**
   * NEW in v2.1.  All persons linked to this case, with their roles and
   * hydrated Person objects.  Populated by CaseService.hydrate().
   */
  linkedPeople: Array<{ ref: CasePersonRef; person: Person }>;
  caseRecord: CaseRecord;
  alerts?: AlertRecord[];
}
```

---

## 6. Migration Strategy: v2.0 → v2.1

### 6.1 Principles

- Migration is a **pure function**: `(NormalizedFileData_v20) => NormalizedFileData_v21`.
- It is idempotent: running it twice on the same input produces the same output.
- It is **lossless**: every field present in v2.0 survives in v2.1.  Specifically:
  - `Relationship.phone` is preserved in `PersonRelationship.legacyPhone` on every relationship entry.
  - `Relationship.name` is preserved in `PersonRelationship.displayNameFallback` **when** the name cannot be resolved to a known person (`targetPersonId` remains `null`).  When the name resolves successfully, the name is not separately stored because it can be recovered from the linked `Person` record; implementers should document this conditional preservation behaviour.
  - Free-text `familyMembers` values that cannot be resolved to person IDs are preserved in `Person.legacyFamilyMemberNames[]`.
- It never modifies the source file in-place; the caller decides whether to write back.
- Migration runs **lazily on file open** — not eagerly on app start.

### 6.2 Migration algorithm

```
function migrateV20ToV21(v20: NormalizedFileData_v20): NormalizedFileData_v21

  // --- Pass 1: Collect and deduplicate all persons from all cases ---
  1. Collect every embedded person from v20.cases[].person
  2. For each collected person (build people[] — no relationship resolution yet):
       a. If person.id already exists in seen_ids → reuse; record that this
          case and the earlier case share the same person.
       b. If person.id is absent or empty → generate a new UUID and assign it.
       c. Merge into global people[] array (deduplicate by id only — see §9.3).
       d. Set updatedAt = createdAt if updatedAt is absent.
       e. Rename familyMembers → familyMemberIds:
            - Values that pass UUID validation: keep in familyMemberIds[].
            - Values that fail validation (free-text names): move to
              Person.legacyFamilyMemberNames[]; write migration warning to activityLog.
       f. Ensure relationships array is present:
            - If relationships is absent or null → set relationships = []
              (was optional; now required).
            - Replace null/absent relationship.id values with new UUIDs.
            - Copy relationship.phone → PersonRelationship.legacyPhone on every entry.
            - Leave targetPersonId unresolved for now (resolved in Pass 2).

  // --- Pass 2: Resolve relationship names against the COMPLETE people[] array ---
  //     Running this as a second pass ensures resolution is order-independent
  //     and idempotent regardless of case ordering in the input.
  3. For each person in people[]:
       For each relationship entry:
         - If **exactly one** Person with a matching name exists in people[], set
           targetPersonId to that Person.id.
         - If zero matches or more than one match (ambiguous), set
           targetPersonId = null and copy name → displayNameFallback
           (ambiguous matches are treated as unresolved to prevent mis-linking).

  // --- Pass 3: Rewrite cases ---
  4. Rewrite each case:
       a. Replace inline person with people: [{ personId: person.id, role: "applicant", isPrimary: true }]
       b. Preserve all other case fields unchanged
  5. Set version = "2.1"
  6. Return new object (do not mutate input)
```

### 6.3 Migration module location

```
utils/storageV21Migration.ts    # pure migration function and related types
```

> **Convention note:** Existing migrations (`legacyMigration.ts`, `categoryConfigMigration.ts`,
> `financialItemMigration.ts`) are flat files directly under `utils/`.  The v2.0 → v2.1 migration
> follows this same flat convention.  If the migration grows significantly (e.g., with separate
> type aliases and helpers), a `utils/migration/` subdirectory is an option, but a single flat
> file is preferred unless complexity demands otherwise.

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

> **⚠️ Prerequisite — upgrade the write path first.**  The current `writeNormalizedData`
> implementation hardcodes `version: "2.0"` and only copies v2.0 collections.  If migration is
> enabled before the writer is updated, the write-back will strip the new `people[]` array and
> downgrade the file back to v2.0.  The write path **must** be upgraded to handle v2.1
> (writing `version: "2.1"` and serialising all v2.1 fields including `people[]`) as a
> **Week 2 prerequisite** before enabling lazy migration in `readFileData()`.

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
| **Normalized (stored)** | `StoredCase` with `people: CasePersonRef[]` — what lives on disk |
| **Hydrated (runtime)** | `CaseDisplay` with `person: Person` (primary) + `linkedPeople` — what the UI uses |
| **Hydrate** | Resolve each `personId` in `CasePersonRef[]` → full `Person` objects at read time |
| **Dehydrate** | Strip resolved `Person` objects back to `CasePersonRef[]` (ID refs only) at write time |

### 7.2 Hydration in `CaseService`

```typescript
// Proposed addition to CaseService
hydrate(storedCase: StoredCase, people: Person[]): CaseDisplay {
  const primaryRef = storedCase.people.find(r => r.isPrimary);
  if (!primaryRef) {
    throw new DataIntegrityError(
      `Case ${storedCase.id} has no primary person reference`
    );
  }

  const linkedPeople = storedCase.people.map(ref => {
    const person = people.find(p => p.id === ref.personId);
    if (!person) {
      throw new DataIntegrityError(
        `Person ${ref.personId} not found for case ${storedCase.id}`
      );
    }
    return { ref, person };
  });

  const primaryEntry = linkedPeople.find(lp => lp.ref.isPrimary);
  if (!primaryEntry) {
    // Should be unreachable given the primaryRef check above, but guard defensively
    throw new DataIntegrityError(`Case ${storedCase.id}: failed to resolve primary person after validation`);
  }
  const primaryPerson = primaryEntry.person;

  return {
    ...storedCase,
    person: primaryPerson,
    linkedPeople,
    caseRecord: { ...storedCase.caseRecord, financials: { resources: [], income: [], expenses: [] }, notes: [] },
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
  const { person: _person, linkedPeople: _linkedPeople, caseRecord, alerts: _alerts, ...rest } = display;
  const { financials: _financials, notes: _notes, ...storedCaseRecord } = caseRecord;
  return {
    ...rest,        // includes id, name, mcn, status, priority, createdAt, updatedAt, people: CasePersonRef[]
    caseRecord: storedCaseRecord,
  };
}
```

### 7.4 `DataManager` integration

`DataManager` methods that currently return `StoredCase[]` should return `CaseDisplay[]` after hydration.  Methods that accept user input and write to disk call `CaseService.dehydrate()` before persisting.

> **Storage notification:** All file-based write paths in `DataManager` must persist via `FileStorageService.writeNormalizedData()`.  That method already handles UI notification internally by calling `this.fileService.broadcastDataUpdate(finalData)`, so no additional notification helper is needed for file storage mutations.  New v2.1 write paths (`PersonService` mutations, `linkPersonToCase`, etc.) must also route through `writeNormalizedData()` to participate in this mechanism.  Use `safeNotifyFileStorageChange()` **only** for non-file-storage mutations (e.g., localStorage-based hooks) that cannot go through `FileStorageService`.

Key touch points:

| DataManager method | Change |
|---|---|
| `getCases()` | call `hydrateAll` after read |
| `getCaseById()` | call `hydrate` after read |
| `createCase()` | accept `CaseDisplay` with `people: CasePersonRef[]`; call `dehydrate`; ensure all referenced persons exist in `people[]` |
| `updateCase()` | call `dehydrate`; never touch `people[]` unless `PersonService.updatePerson()` is also called |
| `deleteCase()` | remove case; **do not** remove linked persons (they may be linked to other cases) |
| `getCasesForPerson()` | new — returns all cases whose `people[]` contain the given personId |

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

Following the config object pattern used by all other services (e.g., `CaseService`, `FinancialsService`):

```typescript
export interface PersonServiceConfig {
  fileStorage: FileStorageService;
}

export class PersonService {
  private readonly fileStorage: FileStorageService;

  constructor(config: PersonServiceConfig) {
    this.fileStorage = config.fileStorage;
  }
}
```

### 8.3 Proposed public API

```typescript
// ── Read ──────────────────────────────────────────────────────────────
getPersonById(personId: string): Promise<Person>
getAllPeople(): Promise<Person[]>
/** Returns all persons linked to the given case (supports multi-person cases) */
getPeopleForCase(caseId: string): Promise<Person[]>
/** Convenience shorthand — resolves only the primary applicant for the case */
getPrimaryPersonForCase(caseId: string): Promise<Person>
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
/** Link a person to a case with a given role. Pass isPrimary: true to designate them as applicant. */
linkPersonToCase(personId: string, caseId: string, role: CasePersonRole, isPrimary?: boolean): Promise<void>
unlinkPersonFromCase(personId: string, caseId: string): Promise<void>
getCasesForPerson(personId: string): Promise<StoredCase[]>

// ── Relationships ──────────────────────────────────────────────────────
addRelationship(personId: string, rel: Omit<PersonRelationship, "id">): Promise<Person>
updateRelationship(personId: string, relId: string, patch: Partial<PersonRelationship>): Promise<Person>
removeRelationship(personId: string, relId: string): Promise<Person>
```

### 8.4 `NewPersonData` type

> **Note:** An interface named `NewPersonData` already exists in `types/case.ts`.
> It omits system-generated fields and makes several properties optional (`organizationId`,
> `authorizedRepIds`, `familyMembers`, `relationships`).  v2.1 will **reconcile** this existing
> interface rather than introducing a conflicting alias.  Specifically:
>
> - Rename `familyMembers?: string[]` → `familyMemberIds?: string[]`
> - Add `legacyFamilyMemberNames?: string[]` (new optional field)
> - Existing optional fields remain optional to avoid breaking current call sites.

```typescript
// Conceptual helper — the existing NewPersonData interface will be updated to match this.
// Omits all system-generated/derived fields: id (stable UUID), name (derived from
// firstName+lastName per §11.2), createdAt/updatedAt (timestamps), and dateAdded
// (audit date — see existing NewPersonData in types/case.ts).
type PersonWithoutSystemFields = Omit<Person, "id" | "name" | "createdAt" | "updatedAt" | "dateAdded">;
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
// DataManager constructor — uses the same config object pattern as other services
this.personService = new PersonService({ fileStorage: this.fileStorage });
```

Expose via `DataManager.people` property (matching the pattern for `this.cases`, `this.financials`, etc.) or proxy individual methods directly on `DataManager`.

---

## 9. Data Integrity Rules and Edge Cases

### 9.1 Foreign key enforcement

| Constraint | Enforcement point |
|---|---|
| Every `personId` in `StoredCase.people[].personId` must exist in `people[]` | `CaseService.hydrate()` throws `DataIntegrityError`; `FileStorageService.writeNormalizedData()` runs a pre-write integrity check |
| `StoredCase.people[]` must have exactly one entry with `isPrimary: true` | Validated by `PersonService.linkPersonToCase()` and `CaseService.dehydrate()` |
| `PersonRelationship.targetPersonId` must exist in `people[]` or be `null` | `PersonService.addRelationship()` validates before write |
| `Person.authorizedRepIds[]` members must exist in `people[]` | `PersonService.updatePerson()` validates; orphan IDs are removed with a logged warning |
| `Person.familyMemberIds[]` members must exist in `people[]` | Same as above |

### 9.2 Orphan person detection

A periodic integrity sweep (opt-in; not on every save) should:

1. Collect all `personId` values referenced across all `StoredCase.people[]` arrays.
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

Migration warnings are **proposed** to be written to `activityLog` (see open question §11.7) so they are visible in the app's activity history without polluting the `Person` schema with metadata fields.

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
| `migrateV20ToV21` | Happy path; duplicate persons; missing IDs; partial persons; idempotency; `legacyPhone` preservation; ambiguous relationship name match | `__tests__/utils/storageV21Migration.test.ts` |
| `PersonService.createPerson` | Creates record; generates ID; timestamps correct | `__tests__/services/PersonService.test.ts` |
| `PersonService.deletePerson` | Blocks when linked to case; succeeds when unlinked; forceDelete removes links | same |
| `PersonService.addRelationship` | Validates targetPersonId; prevents self-link; returns updated Person | same |
| `CaseService.hydrate` | Resolves primary person; resolves all linked persons; throws when primary ref absent; throws on missing personId | `__tests__/services/CaseService.test.ts` |
| `CaseService.dehydrate` | Strips `person` and `linkedPeople`; strips `financials`/`notes` from `caseRecord`; no mutation | same |
| `FileStorageService` integrity check | Pre-write check catches broken personId refs in `people[]` | `__tests__/services/FileStorageService.test.ts` |

### 10.2 Migration test matrix

| Scenario | Expected outcome |
|---|---|
| Single case with a valid Person (has id) | Person extracted to `people[]`; case gains `people: [{personId, role: "applicant", isPrimary: true}]`; version = "2.1" |
| Two cases sharing the same person.id | Single Person in `people[]`; both cases reference it via their `people[]` |
| Person with no id | New UUID assigned; warning logged; person added to `people[]` |
| Person with all blank fields | Partial record created with generated ID; migration warning written to `activityLog` (proposed — see §11.7) |
| Case with `Relationship` entries (name-based) | Name resolved to matching Person if possible (exact one match); else `targetPersonId = null`, `displayNameFallback` set; `legacyPhone` always copied |
| Case with `Relationship` entry whose name matches multiple persons | `targetPersonId = null`, `displayNameFallback` set; ambiguous-match warning emitted |
| `familyMembers` containing UUID strings | Renamed to `familyMemberIds`; validated against `people[]` |
| `familyMembers` containing free-text names | Stored in `Person.legacyFamilyMemberNames[]` (not discarded); warning written to `activityLog` |
| Already-migrated v2.1 file passed to migration | Returns input unchanged (idempotency) |
| File with missing `people` property | Treated as v2.0; migration runs |
| Archive file with v2.0 schema | Migrated identically to main file |
| Two cases with persons sharing the same name + DOB but different IDs | Both persons kept as separate entries; structured warning emitted (see §9.3) |

### 10.3 Integration test scope

- Open a v2.0 file → app triggers migration → file is v2.1 on disk after save.
- Create a case → `PersonService.createPerson` called → person appears in `people[]`.
- Link a second person to a case → case has two entries in `people[]`; one `isPrimary: true`.
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
  readFileData: vi.fn<() => Promise<NormalizedFileData>>(),
  writeNormalizedData: vi.fn<(data: NormalizedFileData) => Promise<NormalizedFileData>>(),
};
const service = new PersonService({ fileStorage: mockFileService } as unknown as PersonServiceConfig);
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

### 11.8 `CaseRecord.personId` / `spouseId` disposition in v2.1
- **Q:** The v2.1 `StoredCase.caseRecord` is typed as `Omit<CaseRecord, "financials" | "notes">`, which means `CaseRecord.personId` and `CaseRecord.spouseId` are still persisted inside `caseRecord` even though `StoredCase.people[]` is now the authoritative person-link.  Which approach should v2.1 take?
- **Options:**
  - (A) Leave both fields in `CaseRecord` for v2.1 and document them as legacy/read-only; a v2.2 migration removes them.
  - (B) Expand the `Omit` to `Omit<CaseRecord, "financials" | "notes" | "personId" | "spouseId">` immediately and migrate the data in `migrateV20ToV21`.
- **Recommendation (proposed):** Option (A) for v2.1 — remove in v2.2.  New code must never write these fields; `CaseService.dehydrate()` should explicitly omit them.

---

## 12. Phased Implementation Plan

This plan maps directly to the March 2026 roadmap weeks.

### Week 2 (March 9–15): Data Model & Storage Refactoring

**Prep**
- [ ] Finalize review of this design doc; record decisions on §11 open questions — in particular §11.7 (migration warning destination) which is referenced by §10.2 row 4 and must be resolved before `migrateV20ToV21` is implemented.
- [ ] Inventory all TypeScript files that import `Person`, `StoredCase`, or `CaseDisplay`; produce a checklist of files that need updating.
- [ ] Diagram the hydration callgraph through `DataManager` (which methods call read? which call write?).

**Implementation**
- [ ] Add `CasePersonRef`, `PersonRelationship`, and `PersonLinkedToCaseError` types; update `Person` interface for v2.1 (`updatedAt`, `familyMemberIds`, `legacyFamilyMemberNames`, `relationships` required).
- [ ] Update `StoredCase` to use `people: CasePersonRef[]` instead of embedded `Person`.
- [ ] Update `NormalizedFileData` to v2.1 shape (add `people: Person[]`; bump version literal).
- [ ] Update `isNormalizedFileData` type guard.
- [ ] **Upgrade `writeNormalizedData` to v2.1** (prerequisite before enabling migration — see §6.4).
- [ ] Verify that all v2.1 write paths go through `writeNormalizedData()` so that `broadcastDataUpdate()` fires automatically after successful writes (no additional notification helper needed — see §7.4).
- [ ] Implement `utils/storageV21Migration.ts` (pure function; no I/O).
- [ ] Wire migration into `FileStorageService.readFileData()`.
- [ ] Implement `PersonService` with full API (§8.3), using config object constructor.
- [ ] Register `PersonService` in `DataManager`.

**Tests**
- [ ] Unit tests for `migrateV20ToV21` covering the full test matrix (§10.2) — all 12 scenarios.
- [ ] Unit tests for `PersonService` (§10.1).

### Week 3 (March 16–22): Hydration & Service Layer Updates

**Prep**
- [ ] Run `npm run typecheck` to surface all TypeScript errors caused by the `StoredCase` shape change (embedded `person` → `people: CasePersonRef[]`); triage each one.
- [ ] List all UI components that access `caseDisplay.person` or `storedCase.person` directly.

**Implementation**
- [ ] Add `CaseService.hydrate()` and `CaseService.dehydrate()`.
- [ ] Update `DataManager` read methods to call `hydrateAll` before returning.
- [ ] Update `DataManager` write methods to call `dehydrate` before persisting; verify each write method goes through `FileStorageService.writeNormalizedData()` (which handles `broadcastDataUpdate()` internally — see §7.4).
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
      "name": "Doe, Jane — 2025-0042",
      "mcn": "2025-0042",
      "status": "Active",
      "priority": false,
      "createdAt": "2025-01-10T09:00:00.000Z",
      "updatedAt": "2025-01-10T09:00:00.000Z",
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

> **Note:** The v2.0 example above omits `categoryConfig`, `activityLog`, `exported_at`, and
> `total_cases` for brevity. See `NormalizedFileData` in `utils/services/FileStorageService.ts`
> for the complete current v2.0 shape.
> Person objects are also truncated; see §5.2 for all required fields.

### v2.1 (proposed)

> **Note on `name` field:** The example below retains `name` to reflect the current `Person` type.
> Open question §11.2 proposes removing it in favour of computing `"${firstName} ${lastName}"` at hydration time.
> The decision is pending review.

> **Note on this example:** The v2.0 source has a single case whose embedded `person` is Jane Doe.
> The migration (§6.2 Pass 1) extracts only persons from `cases[].person`, so only Jane Doe enters
> `people[]`.  John Doe appears only as a `Relationship.name` string in the v2.0 data and is NOT
> extracted as a new `Person` record.  Pass 2 resolves names against the complete `people[]` — since
> no `Person` named "John Doe" exists, the relationship is left unresolved (`targetPersonId: null`,
> `displayNameFallback: "John Doe"`).  To see a fully-resolved relationship, the v2.0 data would
> need a second case whose embedded `person` is John Doe.

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
          "targetPersonId": null,
          "displayNameFallback": "John Doe",
          "legacyPhone": "555-0101"
        }
      ],
      "familyMemberIds": ["person-xyz"],
      "authorizedRepIds": [],
      "createdAt": "2025-01-10T09:00:00.000Z",
      "updatedAt": "2025-01-10T09:00:00.000Z",
      "dateAdded": "2025-01-10"
    }
  ],
  "cases": [
    {
      "id": "case-001",
      "name": "Doe, Jane — 2025-0042",
      "mcn": "2025-0042",
      "status": "Active",
      "priority": false,
      "createdAt": "2025-01-10T09:00:00.000Z",
      "updatedAt": "2025-01-10T09:00:00.000Z",
      "people": [
        { "personId": "person-abc", "role": "applicant", "isPrimary": true }
      ],
      "caseRecord": { "applicationDate": "2025-01-10" }
    }
  ],
  "financials": [],
  "notes": [],
  "alerts": []
}
```

> **Note:** The example above shows only the `people` and `cases` arrays for brevity.
> A complete v2.1 file also includes `categoryConfig`, `activityLog`, `templates`,
> `exported_at` (snake_case — intentional, matches the v2.0 schema convention), and `total_cases`
> as documented in §5.1.  Person objects are also truncated; required fields not shown include
> `organizationId`, `livingArrangement`, `address`, `mailingAddress`, and `status` — see §5.2 for
> the complete `Person` interface.

---

*End of document. Please add review comments or mark open questions in §11 as resolved before implementation begins.*
