---
applyTo: "__tests__/**/*.ts,__tests__/**/*.tsx,domain/**/*.test.ts,src/test/**/*.ts,src/test/**/*.tsx"
---

# Testing Instructions

- Follow the Vitest and React Testing Library patterns documented in `.github/testing-guide.md`.
- Structure tests with explicit Arrange / Act / Assert sections and comments.
- Use strict assertions such as `toEqual`, `toMatchObject`, and `toHaveLength`; avoid weak assertions like `toBeTruthy()` and `toBeDefined()`.
- Keep mocks typed; do not use `as any` when creating test doubles.
- Prefer existing helpers from `src/test/testUtils.ts` when you need normalized workspace fixtures or common test data setup.
- Add accessibility coverage with `jest-axe` for new interactive UI components when applicable.
- Run the narrowest relevant tests first, then confirm the full suite with `npm run test:run` before finishing substantial test-related work.
