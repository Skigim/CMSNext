# CMSNext Improvement Strategy — Archived Phases

_Archived: September 26, 2025_

## Phase 1 · Component Decomposition (Completed)
- **App shell extraction**
  - ✅ Extracted connection and onboarding responsibilities into `useConnectionFlow`, trimming modal wiring out of `App.tsx`.
  - ✅ Ported note modal and CRUD logic into `useNoteFlow`, keeping case state updates centralized and predictable.
  - ✅ Introduced `useNavigationFlow`, which centralizes view/sidebar handling and dropped `App.tsx` under the 400-line target.
  - ✅ Split `AppContent` into memo-friendly view modules (`AppContentView`, `AppLoadingState`, `ConnectionOnboarding`, `CaseWorkspace`) with a `useAppContentViewModel` helper, and migrated import listeners into `useImportListeners` to reduce dependency-array churn.
- **Financial workflows**
  - ✅ Moved financial item modal orchestration into `useFinancialItemFlow`, aligning CRUD handlers with the DataManager pattern.
  - ✅ Broke `FinancialItemCard` into dedicated presentation pieces (`FinancialItemCardHeader`, `FinancialItemCardMeta`, `FinancialItemCardActions`, `FinancialItemCardForm`) plus the `useFinancialItemCardState` hook; card wrapper now focuses on composition and remains well under the 400-line goal.
  - 🔄 Next: Strengthen the financial item experience with targeted RTL coverage and explore list-level controller abstractions if new requirements emerge.

**Success metric:** Maintain `App.tsx` at or below the 397-line footprint while finishing the workspace split, and drive `FinancialItemCard.tsx` to < 400 lines post-refactor with unit coverage for the new hooks/components.

## Phase 2 · Testing Expansion (Completed Planning)
- Add React Testing Library suites for `CaseForm`, `FinancialItemCard`, and `ConnectToExistingModal`, covering happy paths, validation errors, and cancellation flows.
- Create an integration-style test that exercises “connect → load cases → edit → save”, using `msw` to emulate File System Access behaviour.
- Update `/docs/development/testing-infrastructure.md` to describe when to add RTL vs. Vitest-only coverage.

**Success metric:** +10 UI/flow tests, maintain zero lint errors, CI runtime increase < 2 minutes.
