## General Approach

- [Existing bullets]

## Environment and Validation

### Startup Checklist

Before making changes, establish the repo environment using this sequence:

1. Read `README.md` for product, architecture, and command overview.
2. Read `.github/implementation-guide.md`, `.github/ui-guide.md`, and `.github/testing-guide.md` before introducing new patterns.
3. Use `npm` for all package management and script execution.
4. Install dependencies with `npm ci` when lockfile fidelity matters; otherwise use `npm install` only if necessary.
5. Prefer existing scripts over ad hoc shell commands.

### Standard Validation Commands

For meaningful code changes, run the full verification flow:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Treat failures in any step as blockers before considering the work complete.

### Runtime Assumptions

- This is a local-first React + TypeScript + Vite application.
- There is no backend, no remote API, and no cloud sync layer.
- Primary persistence depends on the File System Access API.
- Browser-specific flows should assume a supported Chromium-based environment for full functionality.
- Unsupported browsers should receive compatibility handling, not fake fallback behavior.

### Implementation Constraints for Agents

- Do not introduce backend, authentication, database, repository, cache, or event-bus patterns.
- Route mutations through `DataManager` and existing services.
- Keep domain logic pure and free of React or I/O dependencies.
- Do not bypass `AutosaveFileService` or file storage notifications.
- Preserve provider ordering and context contracts.

### Testing Expectations

- Add or update tests when changing business logic, hooks, services, or UI behavior.
- Use existing Vitest and React Testing Library patterns already documented in `.github/testing-guide.md`.
- Include accessibility coverage for new interactive UI where applicable.
- Do not consider a task done if tests or build are failing.

### Agent Workflow Preference

When starting a task, prefer this order:

1. Inspect existing docs and patterns.
2. Find the nearest existing implementation.
3. Make the smallest coherent change.
4. Validate with the standard command sequence.
5. Update documentation only when behavior or workflow meaningfully changes.

## Architecture