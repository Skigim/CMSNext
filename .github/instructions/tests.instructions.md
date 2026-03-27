---
description: "Use when writing or updating tests. Covers shared test utilities, shared mocks, AAA structure, strict assertions, and accessibility checks."
applyTo: "__tests__/**/*.ts,__tests__/**/*.tsx,domain/**/*.test.ts,domain/**/*.test.tsx,src/test/**/*.ts,src/test/**/*.tsx"
---

# Testing Instructions

- Follow the Vitest and React Testing Library patterns documented in `.github/testing-guide.md` and the broader repository conventions in `CLAUDE.md`.
- Structure tests with explicit Arrange / Act / Assert sections and comments.
- Use strict assertions such as `toEqual`, `toMatchObject`, and `toHaveLength`; avoid weak assertions like `toBeTruthy()` and `toBeDefined()`.
- Keep mocks typed; do not use `as any` when creating test doubles.
- Prefer this reuse order for test setup and fixtures: **shared helpers** → **shared mocks** → **local inline setup as a last resort**.
- Reuse shared helpers from `@/src/test/testUtils` for normalized workspace fixtures, common data setup, and reusable test factories before creating new local objects.
- Reuse `@/src/test/reactTestUtils` for provider-aware render helpers before composing ad hoc render wrappers in individual test files.
- Reuse shared mocks from `__tests__/__mocks__` and existing mock setup helpers before adding new local mocks.
- Prefer shared module mocks or reusable mock setup helpers over repeating the same `vi.mock(...)` blocks across multiple test files.
- Do not introduce inline object factories when a reusable helper or shared mock already exists; only fall back to local inline setup when no shared utility matches the test need.
- Do not access `localStorage` directly in tests unless no reusable utility exists; prefer existing adapters, helpers, and test utilities first.
- Add accessibility coverage with `jest-axe` for new interactive UI components when applicable.
- Run the narrowest relevant tests first, then confirm the full suite with `npm run test:run` before finishing substantial test-related work.
