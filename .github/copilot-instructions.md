# CMSNext - AI Coding Agent Instructions

## Refactor Prep
- Treat all current work as groundwork for the upcoming architecture refactor; avoid introducing new patterns until the refactor plan locks.
- Maintain continuity of context across tasks—summarize decisions, note remaining TODOs, and keep roadmap + feature catalogue in sync.
- Surface any blockers or missing context immediately so the refactor kickoff starts with a complete picture.
- Document the provider stack as our edge-style API layer: keep calling contracts, error envelopes, and telemetry notes current so the eventual worker boundary remains a drop-in change.
- Track shadcn migration progress component-by-component; see the checklist below and update entries as work lands.

## Architecture & Stack
- Filesystem-only data flow: always call `fileDataProvider.getAPI()`; halt work if it returns `null`.
- Mutations go `FileStorageAPI → AutosaveFileService → File System Access API`; call `safeNotifyFileStorageChange()` after writes.
- Core contexts: `FileStorageContext` (permissions/handles) and `ThemeContext` (five themes: light, paperwhite, paper, soft-dark, dark); there is no auth context.
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
- Claude–Codex workflow: `docs/development/claude-codex-workflow.md`
- MCP setup (Codex): ensure `~/.codex/config.toml` contains
  
	```toml
	[mcp_servers.shadcn]
	command = "npx"
	args = ["shadcn@latest", "mcp"]
	```
	and restart Codex after editing.

## Shadcn/UI Migration Checklist
- [x] `components/financial/FinancialItemCard*` → replace `.financial-item-*` classes with shadcn primitives.
- [x] `components/diagnostics/FileStorageDiagnostics.tsx` → wrap diagnostics UI with `Card`, `Button`, `Badge`.
- [x] `components/app/AppLoadingState.tsx` → shift spinner placeholder to shadcn loader/skeleton.
- [x] `components/app/ConnectionOnboarding.tsx` → use shadcn dialog/shell for the onboarding modal.
- [x] `components/app/CaseWorkspace.tsx` → convert error banner/button to shadcn `Alert` and `Button`.
- [x] `components/error/ErrorFallback.tsx` → rebuild fallback cards on shadcn `Card`/`Alert`.
- [x] `components/figma/ImageWithFallback.tsx` → replace custom fallback styling with shadcn `AspectRatio`/`Skeleton`.

**Status:** ✅ 100% Complete (Pull Request 28 merged October 15, 2025)
