# CMSNext Repository Memory Reference

## Architecture And Data Flow

- `DataManager` orchestrates stateless services in `utils/services/*`.
- Domain code stays pure: no I/O, no React, no side effects.
- Shared business logic should live in `@/domain/*` or reusable utilities, not components.

## Storage And Persistence

- Case data is persisted through the File System Access API.
- UI preferences go through `createLocalStorageAdapter`, never direct `window.localStorage` access.
- Passwords and sensitive session secrets belong in `useRef` or transient session state, not persisted storage.
- The main persisted format is normalized v2.1 with `people`, `cases`, `financials`, `notes`, `alerts`, `categoryConfig`, `activityLog`, and optional `templates`.

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
