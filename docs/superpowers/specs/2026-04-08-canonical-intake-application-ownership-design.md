# Canonical Intake Application Ownership Design

## Goal

Move intake create and edit onto canonical `applications[]` ownership with the smallest possible UI change, while keeping existing case-facing screens functional through a temporary compatibility bridge.

## Scope

This slice covers canonical application reads and writes for intake create and intake edit, compatibility hydration for current display surfaces, and the selection rules needed when a case has multiple applications.

This slice does not add UI for creating additional applications on an existing case. It also does not remove the compatibility and migration bridge yet; that cleanup is the explicit next PR once canonical write paths are stable.

## Core Decisions

- `applications[]` becomes the source of truth for application-owned fields.
- Intake create creates the first canonical application record.
- Intake edit updates the oldest non-terminal application for the case, ordered by `applicationDate`.
- Terminal versus non-terminal state is determined by the existing completed or terminal status configuration flow.
- If a case has no non-terminal application, application-owned fields remain visible but disabled.
- Application status is authoritative underneath, but compatibility case status mirrors the same selected application for existing UI.
- Status history appends only when the status value changes.
- The initial application status comes from the existing status configuration flow rather than a hard-coded default.
- The initial status-history entry uses the application date as its effective date. Later status changes use the save date as their effective date.
- `application.applicantPersonId` is historical once the application is created and must not silently track later case applicant changes.
- Non-intake surfaces should display application-owned values from the same selected application, but those surfaces do not edit application-owned fields in this slice.

## Application-Owned Fields

The canonical application layer owns the fields currently represented by the `Application` model and the migration snapshot in `types/application.ts` and `domain/applications/migration.ts`.

Application-owned fields are:

- `applicantPersonId`
- `caseId`
- `applicationDate`
- `applicationType`
- `status`
- `statusHistory`
- `hasWaiver`
- `retroRequestedAt`
- `retroMonths`
- `verification.isAppValidated`
- `verification.isAgedDisabledVerified`
- `verification.isCitizenshipVerified`
- `verification.isResidencyVerified`
- `verification.avsConsentDate`
- `verification.voterFormStatus`
- `verification.isIntakeCompleted`
- `createdAt`
- `updatedAt`

These replace the legacy case-embedded application fields as the authoritative source for intake and compatibility hydration, except for operator review and AVS-processing markers that do not describe the application event itself.

The following fields should be treated as non-application workflow fields and moved out of canonical application ownership in this slice:

- `verification.isAvsSubmitted`
- `verification.avsSubmitDate`
- `verification.hasInterfacesReviewed`
- `verification.reviewVRs`
- `verification.reviewPriorBudgets`
- `verification.reviewPriorNarr`

`verification.avsConsentDate` remains application-owned because AVS consent is part of the application-facing intake data, while downstream AVS processing is not.

## Architecture

Use a targeted compatibility bridge centered on a single shared resolver that selects the active application for display and edit behavior.

The resolver chooses the oldest non-terminal application for a case by `applicationDate`. When `applicationDate` ties or is missing, it falls back deterministically to `createdAt` ascending and then `id` lexicographically ascending. If no non-terminal application exists, the same stable ordering is applied across the terminal set. All application-owned reads and compatibility hydration must use that exact same rule so intake, case details, and any other current display surfaces do not disagree about which application is current.

The architecture has four boundaries:

1. Canonical ownership: application-owned data is stored in and mutated through application records.
2. Selection rule: one shared resolver determines the active application.
3. Compatibility surface: case-facing status and display fields are hydrated from that selected application.
4. Surface split: intake create and edit are the only write paths for application-owned data in this slice.

Relevant implementation areas are expected to include `utils/storageV21Migration.ts`, `utils/services/ApplicationService.ts`, `utils/services/FileStorageService.ts`, `utils/DataManager.ts`, `hooks/useIntakeWorkflow.ts`, and the current intake and case-details display surfaces.

## Data Flow

### Intake Create

Intake create continues building the case, person, and linked-person payloads it already needs. In the same transaction, it also creates the first canonical application record.

That first application record must:

- copy all application-owned fields from the intake payload
- set `applicantPersonId` from the applicant selected at create time
- initialize status from the existing status configuration flow
- create the initial `statusHistory` entry using the application date as `effectiveDate`

### Intake Edit

Intake edit resolves the active application before persisting application-owned fields using the shared resolver rule defined above.

The edit flow must:

- load application-owned fields from that selected application
- write application-owned changes back to that selected application
- append a new status-history entry only when the status value actually changes
- use the save date as the `effectiveDate` for those later status changes

If no non-terminal application exists, application-owned fields stay visible but disabled, and the save path updates only person-owned and case-owned fields.

### Non-Intake Surfaces

Non-intake screens must read application-owned values from the same selected active application rather than from stale legacy case copies. For this slice, those screens do not edit application-owned fields.

Compatibility case status should mirror the selected active application so existing case-facing UI continues to behave consistently.

## Constraints and Error Handling

This slice should fail closed around application editing. It must never invent a hidden “new application” flow when editing a case.

Constraints:

- If no non-terminal application exists, application-owned fields are not editable.
- If multiple applications exist, all current screens must use the same resolver so they agree on which application is current.
- Applicant linkage on an application remains historical once created.
- The completed or terminal status configuration remains the only source for determining whether an application is editable.

Persistence rules:

- Create and edit must remain atomic through the existing `DataManager` path.
- Person, case, and application updates for one save either all succeed or all fail.
- Status history must not append duplicate entries when the status value is unchanged.

## Testing Strategy

Tests should lock the resolver and compatibility behavior before broad UI work expands further.

Service and storage coverage should prove:

- the active application resolver picks the oldest non-terminal application by `applicationDate`
- terminal versus non-terminal classification respects the existing status configuration
- compatibility case status mirrors the selected application
- historical `applicantPersonId` is preserved after application creation

Intake workflow coverage should prove:

- create writes the first canonical application correctly
- edit updates the selected active application rather than legacy case-embedded application fields
- status history appends only on status changes
- application-owned fields are disabled when no non-terminal application exists

Display coverage should prove:

- non-intake surfaces read application-owned values from the selected active application
- non-intake write paths for application-owned fields remain blocked in this slice

These tests should also mark the intentional compatibility behavior that the next cleanup PR will be allowed to remove.

## Out of Scope

- UI for creating an additional application on an existing case
- A dedicated applications view
- Full removal of compatibility hydration and migration-on-save behavior
- Broad UI redesign of intake or case details

## Follow-Up PR

Once this slice is landed and validated, the next PR should remove migration-on-save debt and other compatibility logic that only exists to support writing legacy case-embedded application fields during normal saves.

That cleanup PR should be explicitly framed as debt removal after canonical application ownership is stable, not mixed into this first slice.
