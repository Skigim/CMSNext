# CMSNext - AI Coding Agent Instructions

## Architecture & Stack
- Filesystem-only data flow: always call `fileDataProvider.getAPI()`; halt work if it returns `null`.
- Mutations go `FileStorageAPI → AutosaveFileService → File System Access API`; call `safeNotifyFileStorageChange()` after writes.
- Core contexts: `FileStorageContext` (permissions/handles) and `ThemeContext` (six themes); there is no auth context.
- Autosave debounce is 5s; do not bypass `AutosaveFileService` or invent alternative storage layers.
- Guard unsupported browsers by checking `isSupported`, surfacing the compatibility prompt, and treating `AbortError` as a non-error.

## UI Conventions
- Prefer shadcn/ui primitives from `components/ui/*`; keep styling within Tailwind v4 tokens.
- Memoize expensive components or selectors and rely on domain hooks (`useCaseManagement`, `useNavigationFlow`, etc.).
- Toast feedback must use Sonner with loading → success/error flows; never use `alert()`.
- Keep autosave badges and storage toasts aligned with storage states and update docs when copy shifts.
- Protect accessibility: maintain focus management in modals, verify keyboard paths, and add axe checks as features land.

## Antipatterns
- ❌ No localStorage/sessionStorage, network APIs, or databases.
- ❌ No direct filesystem calls outside the provider stack or autosave service.
- ❌ No long-lived feature branches; ship small slices with tests and telemetry.
- ❌ Do not mutate state without notifying storage or introduce optimistic UI that ignores autosave timing.
- ❌ Avoid bespoke component libraries or inline styles that diverge from shadcn conventions.

## Further Reading
- Architecture & storage: `docs/development/feature-catalogue.md`
- Delivery plan: `docs/development/actionable-roadmap.md`
- Testing & tooling: `docs/development/testing-infrastructure.md`
- Performance + usage capture: `docs/development/performance-metrics.md`, `scripts/`