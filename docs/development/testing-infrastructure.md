# CMSNext Testing Quick Reference

## Test Stack
- Vitest powers unit, integration, and component suites (`vitest.config.ts`)
- React Testing Library drives UI tests; `@testing-library/jest-dom` adds assertions
- jsdom lives in `__tests__/setup.test.tsx` to keep the browser environment consistent

## Everyday Commands
- `npm run test:run` – execute the full suite once (CI equivalent)
- `npm run test:watch` – watch mode while developing
- `npm run test -- --run <pattern>` – target specific files (for example `useNavigationFlow`)
- `npm run test:coverage` – generate coverage data under `reports/coverage/`

## Writing & Updating Tests
- Mirror the app structure under `__tests__/` (hooks, components, integration)
- Reuse the File System Access API mocks defined in `__tests__/setup.test.tsx`
- Assert behaviour, not implementation details—use RTL for anything user-visible
- Keep fixtures small; reach for the seed-data helpers in `scripts/` when you need realistic payloads

## Before Shipping
- Run `npm run test:run` to confirm green status
- Skim `reports/coverage/index.html` if you touched critical flows
- Add or update tests alongside feature work so the suite stays trustworthy
