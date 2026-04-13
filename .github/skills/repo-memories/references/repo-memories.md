# CMSNext Repository Memory Reference

Use this reference first on every CMSNext task before deeper reasoning, searches, edits, reviews, or delegation.

## Architecture And Data Flow

- `DataManager` orchestrates stateless services in `utils/services/*`.
- Domain code stays pure: no I/O, no React, no side effects.
- Shared business logic should live in `@/domain/*` or reusable utilities, not components.

## Storage And Persistence

- Case data is persisted through the File System Access API.
- UI preferences go through `createLocalStorageAdapter`, never direct `window.localStorage` access.
- LocalStorage keys created via `createLocalStorageAdapter` must use the `cmsnext-[feature-name]` pattern, where `[feature-name]` is a short kebab-case identifier.
- Passwords and sensitive session secrets belong in `useRef` or transient session state, not persisted storage.
- The main persisted format is strict canonical v2.2 with `people`, `cases`, optional `applications`, `financials`, `notes`, `alerts`, `categoryConfig`, `activityLog`, and optional `templates`.
- Normal runtime reads accept only canonical persisted v2.2 workspace and archive files; older schemas must be upgraded outside the current runtime.

## Service And Hook Conventions

- Use `readDataAndVerifyCase` or existing service helpers instead of repeating read-verify-throw patterns.
- Catch `error`, not `err`, and prefer `extractErrorMessage(error)` for user-facing messages.
- Hooks should stay focused and generally split when they grow beyond a single responsibility.
- Use `useDataSync` and existing guards rather than inventing parallel state sync patterns.

## UI And Testing

- Components stay UI-only and use hooks rather than services directly.
- Use shadcn/ui primitives, Tailwind tokens, and shared utilities instead of inline custom patterns.
- `console.log`, `console.warn`, and `console.error` are forbidden in production code.
- Tests should use strict assertions, typed mocks, and `jest-axe` where interactive UI changes are involved.

## Validation Workflow

- `npm run typecheck`
- `npm run lint`
- `npm run test:run`
- `npm run build`

## Memory Maintenance

- If a task establishes or clarifies a durable repo convention, update this reference before closing out the work.
- Keep additions short and operational so this file stays fast to load at the start of every task.
