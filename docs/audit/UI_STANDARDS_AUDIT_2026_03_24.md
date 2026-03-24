# CMSNext UI Standards Audit - March 24, 2026

**Date:** March 24, 2026
**Auditor:** GitHub Copilot with `audit` subagent
**Scope:** Workspace-wide static audit of UI standards across React components and styles
**Focus:** shadcn/ui usage, accessibility structure, theme-token usage, layer boundaries, and constrained scrolling patterns

## Standards Clarification

For CMSNext, the local primitive layer under `components/ui/*` is the required UI foundation. Any production UI component that does not build from that shadcn-based primitive layer is out of compliance with project standards, even if the rendered result is visually acceptable.

## Summary

| Severity | Count |
| -------- | ----- |
| Medium   | 4     |
| Low      | 1     |

## Findings

### 1. Medium - Production UI bypasses the required shadcn primitive layer

**Paths**

- `components/financial/FinancialItemSaveIndicator.tsx`
- `components/modals/AuthBackdrop.tsx`
- `components/error/ErrorBoundary.tsx`

**Issue**

- `FinancialItemSaveIndicator` renders custom status UI directly with raw `div` elements, custom spinner markup, and hard-coded success styling instead of composing from the local primitive layer.
- `AuthBackdrop` is a fully bespoke UI/backdrop component composed from raw layout elements and custom decorative styling without using `components/ui/*` primitives.
- `ErrorBoundary` renders its full fallback screen with raw layout elements, custom button markup, and inline SVG rather than composing from local primitives such as `Card`, `Button`, and `Alert`-style building blocks.

**Why it matters**

- Under CMSNext standards, production UI must build from the local shadcn primitive layer.
- Allowing bespoke UI outside that layer creates drift in accessibility, theming, composition patterns, and maintainability.

**Recommended follow-up**

- Rework these components so they compose from local primitives where possible, or create an approved primitive-level abstraction in `components/ui/*` first and build from that.

**Inventory note**

- A broader static sweep found these as the confirmed production UI violations of the primitive-layer rule. Most other non-`components/ui/*` files in `components/` are app-level composites that already compose from the local primitive layer and should not be treated as violations on that basis alone.

### 2. Medium - Dialog accessibility metadata is missing or explicitly disabled

**Paths**

- `components/modals/CaseEditModal.tsx`
- `components/case/CaseFiltersDialog.tsx`
- `components/modals/LoginModal.tsx`

**Issue**

- `CaseEditModal` and `CaseFiltersDialog` render `DialogContent` with a `DialogTitle` but no `DialogDescription`, which violates the repo dialog pattern and reduces screen-reader context.
- `LoginModal` sets `aria-describedby={undefined}` on the loading dialog while still rendering explanatory text, so visible status content is not exposed as the dialog description.

**Why it matters**

- The repo requires dialog title and description structure for accessible modal semantics.
- These dialogs risk reduced clarity for assistive technology users.

**Recommended follow-up**

- Add a real `DialogDescription` to each dialog or wire the existing explanatory text into the accessible description.

### 3. Medium - Dropdown scrolling does not follow the bounded `ScrollArea` pattern

**Path**

- `components/app/PinnedCasesDropdown.tsx`

**Issue**

- The dropdown uses `ScrollArea` directly inside `DropdownMenuContent` with only `max-h-64`, without the documented bounded wrapper pattern (`overflow-hidden flex flex-col` plus explicit upper bound) and without the expected `h-full max-h-*` pairing.

**Why it matters**

- This diverges from the repo standard for constrained dropdown/popover scrolling.
- It increases the chance of overflow or clipping inconsistencies compared with the established pattern used elsewhere.

**Recommended follow-up**

- Refactor this dropdown to match the bounded `ScrollArea` pattern documented in `.github/ui-guide.md`.

### 4. Low - UI component depends directly on a service-layer type

**Path**

- `components/settings/ArchivalSettingsPanel.tsx`

**Issue**

- The component imports `ArchiveFileInfo` from `@/utils/services/CaseArchiveService`.
- Even as a type-only import, this makes the UI depend on a service implementation detail.

**Why it matters**

- The repo keeps components UI-focused and avoids service-layer coupling from the UI layer.
- Service refactors should not force avoidable UI imports to change.

**Recommended follow-up**

- Move the type to `types/*` or expose it through a layer-appropriate shared contract.

### 5. Medium - Repeated hard-coded palette classes bypass theme tokens and established visual language

**Paths**

- `components/alerts/AlertBadge.tsx`
- `components/case/NeedsIntakeBadge.tsx`
- `components/modals/AVSImportModal.tsx`
- `components/app/Settings.tsx`

**Issue**

- These components hard-code color families such as amber, blue, green, and orange directly in Tailwind classes instead of using semantic theme tokens and the repo color-slot/CSS-variable system.

**Why it matters**

- This creates avoidable visual drift across themes.
- Status styling becomes inconsistent with the documented semantic color approach.

**Recommended follow-up**

- Replace hard-coded palette utilities with semantic tokens or existing color-slot variables where appropriate.

## Residual Gaps

This audit was static only. The following areas still need runtime verification in the browser:

- Focus management and keyboard traversal inside dialogs and dropdowns
- Responsive overflow behavior
- Theme switching consistency
- Visual drift that only appears during interaction or animation

## Suggested Remediation Order

1. Migrate bespoke production UI onto the local shadcn primitive layer.
2. Fix dialog accessibility metadata.
3. Normalize constrained dropdown scrolling.
4. Replace hard-coded UI palette classes with semantic theme tokens.
5. Remove the service-layer type dependency from the UI component.
