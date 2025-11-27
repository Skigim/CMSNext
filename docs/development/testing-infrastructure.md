# CMSNext Testing Quick Reference

## Test Stack

- Vitest powers unit, integration, and component suites (`vitest.config.ts`)
- React Testing Library drives UI tests; `@testing-library/jest-dom` adds assertions
- jsdom lives in `__tests__/setup.test.tsx` to keep the browser environment consistent
- jest-axe enables accessibility testing via `toHaveNoViolations()` matcher

## Accessibility Testing with jest-axe

### Setup

The jest-axe matcher is configured in `src/test/setup.ts`:

```typescript
import "jest-axe/extend-expect";
```

### Basic Pattern

```typescript
import { axe, toHaveNoViolations } from "jest-axe";
import { render } from "@testing-library/react";

expect.extend(toHaveNoViolations);

it("has no accessibility violations", async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### When to Use

- Test all interactive components (buttons, forms, modals)
- Verify ARIA attributes are present and correct
- Validate keyboard navigation and focus management
- Check heading hierarchy and semantic HTML structure

### Reference

For comprehensive accessibility testing patterns, see [`docs/development/accessibility-testing.md`](./accessibility-testing.md).

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

## Current Status

- **Test Files:** 40
- **Total Tests:** 244
- **Pass Rate:** 100%
- **Last Updated:** November 26, 2025

## Before Shipping

- Run `npm run test:run` to confirm green status
- Skim `reports/coverage/index.html` if you touched critical flows
- Add or update tests alongside feature work so the suite stays trustworthy
