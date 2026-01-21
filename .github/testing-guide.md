````markdown
# Testing Guide

Comprehensive testing standards for CMSNext. This consolidates patterns from copilot-testing.md, agents/TESTING.md, and testing-guidelines.md.

## Stack

| Tool                        | Purpose                          |
| --------------------------- | -------------------------------- |
| Vitest                      | Test runner (`vitest.config.ts`) |
| React Testing Library       | Component testing                |
| `@testing-library/jest-dom` | DOM matchers                     |
| jest-axe                    | Accessibility testing            |
| `__tests__/setup.test.tsx`  | Global test setup                |

## Commands

```bash
npm test              # Watch mode
npm run test:run      # Single run (CI)
npm run test:coverage # With coverage report
```
````

## Core Constraints

### No "Lazy" Assertions

```typescript
// ❌ FORBIDDEN - Generic checks that prove nothing
expect(result).toBeTruthy();
expect(result).toBeDefined();
expect(array.length).toBeGreaterThan(0);

// ✅ REQUIRED - Strict equality and structure
expect(result).toEqual({ id: "123", status: "ACTIVE" });
expect(array).toHaveLength(3);
expect(array[0]).toMatchObject({ id: 1 });
```

### Type Safety

```typescript
// ❌ FORBIDDEN
const mock = vi.fn() as any;

// ✅ REQUIRED
const mock = vi.fn<[string], Promise<Entity>>();
const mockService = vi.mocked(CaseService);
```

### Testing Strategy

- **Prioritize Edge Cases:** Test `null`, `undefined`, empty strings, empty arrays first
- **Isolation:** Tests must not rely on external state or execution order
- **Mocking:** Explicitly mock all external dependencies

## AAA Pattern

All tests follow Arrange-Act-Assert with comments:

```typescript
it("should throw an error when user is not found", async () => {
  // ARRANGE
  const mockRepo = vi.mocked(UserRepository);
  mockRepo.findById.mockResolvedValue(null);
  const service = new UserService(mockRepo);

  // ACT & ASSERT
  await expect(service.getUser("999")).rejects.toThrow("User not found");
});
```

## Service Testing

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CaseService } from "@/utils/services/CaseService";

describe("CaseService", () => {
  let service: CaseService;
  let mockFileService: vi.Mocked<FileStorageService>;

  beforeEach(() => {
    mockFileService = {
      read: vi.fn(),
      write: vi.fn(),
    } as unknown as vi.Mocked<FileStorageService>;

    service = new CaseService(mockFileService);
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("generates unique ID for new case", async () => {
      // ARRANGE
      const input = { caseNumber: "123", clientName: "Test" };
      mockFileService.read.mockResolvedValue({ cases: [] });

      // ACT
      const result = await service.create(input);

      // ASSERT
      expect(result.id).toMatch(/^case-/);
      expect(result.caseNumber).toBe("123");
    });

    it("throws error for duplicate case number", async () => {
      // ARRANGE
      mockFileService.read.mockResolvedValue({
        cases: [{ id: "case-1", caseNumber: "123" }],
      });

      // ACT & ASSERT
      await expect(service.create({ caseNumber: "123" })).rejects.toThrow(
        "Duplicate case number",
      );
    });
  });
});
```

## Component Testing

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

describe("MyComponent", () => {
  const defaultProps = {
    data: mockData,
    onSubmit: vi.fn(),
  };

  it("renders case number correctly", () => {
    // ARRANGE
    render(<MyComponent {...defaultProps} />);

    // ASSERT
    expect(screen.getByText("Case #123")).toBeInTheDocument();
  });

  it("calls onSubmit when button clicked", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<MyComponent {...defaultProps} onSubmit={onSubmit} />);

    // ACT
    await user.click(screen.getByRole("button", { name: /submit/i }));

    // ASSERT
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    // ARRANGE
    const { container } = render(<MyComponent {...defaultProps} />);

    // ACT & ASSERT
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

## Hook Testing

```typescript
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCaseManagement } from "@/hooks/useCaseManagement";

describe("useCaseManagement", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DataManagerProvider value={mockDataManager}>
      {children}
    </DataManagerProvider>
  );

  it("loads cases on mount", async () => {
    // ARRANGE
    mockDataManager.getAllCases.mockResolvedValue([mockCase]);

    // ACT
    const { result } = renderHook(() => useCaseManagement(), { wrapper });

    // ASSERT
    await waitFor(() => {
      expect(result.current.cases).toHaveLength(1);
      expect(result.current.cases[0].id).toBe(mockCase.id);
    });
  });

  it("handles create case error", async () => {
    // ARRANGE
    mockDataManager.createCase.mockRejectedValue(new Error("Failed"));
    const { result } = renderHook(() => useCaseManagement(), { wrapper });

    // ACT
    await act(async () => {
      await result.current.createCase({ caseNumber: "123" });
    });

    // ASSERT
    expect(result.current.error).toBe("Failed");
  });
});
```

## Mocking Services

```typescript
// __tests__/__mocks__/mockDataManager.ts
export const createMockDataManager = (): vi.Mocked<DataManager> => ({
  getAllCases: vi.fn().mockResolvedValue([]),
  getCaseById: vi.fn().mockResolvedValue(null),
  createCase: vi.fn(),
  updateCase: vi.fn(),
  deleteCase: vi.fn(),
  // ... other methods
});
```

## What to Test

### High Priority

- Service CRUD operations (happy path + errors)
- Hook state transitions and error handling
- Form validation logic
- Edge cases: null, undefined, empty arrays

### Medium Priority

- Component rendering with different data states
- User interactions
- Loading and error states

### Include for All Components

- Accessibility (axe) check
- Keyboard navigation for interactive elements

## Self-Correction Prompt

Before outputting test code, ask:

> "If I broke the logic in the source code (e.g., swapped an `if` condition), would this test still pass?"
> If YES, the test is too weak. Rewrite it to be stricter.

## Verification

After writing tests:

1. **Tests pass:** `npm test`
2. **No regressions:** All existing tests still pass
3. **Coverage:** Check coverage report for gaps
4. **Types:** No TypeScript errors in test files

## Common Pitfalls

| ❌ Don't                    | ✅ Do                                     |
| --------------------------- | ----------------------------------------- |
| Use `any` types             | Use `vi.Mocked<T>`                        |
| `expect(x).toBeTruthy()`    | `expect(x).toBe(expectedValue)`           |
| Test implementation details | Test behavior/outcomes                    |
| Skip edge cases             | Test null, undefined, empty first         |
| Forget cleanup              | Use `beforeEach` and `vi.clearAllMocks()` |
| Skip accessibility          | Include axe check for components          |
| Use `fireEvent`             | Use `userEvent` for interactions          |

## File Locations

| Path                              | Purpose                     |
| --------------------------------- | --------------------------- |
| `__tests__/services/*.test.ts`    | Service unit tests          |
| `__tests__/hooks/*.test.ts`       | Hook unit tests             |
| `__tests__/components/*.test.tsx` | Component tests             |
| `__tests__/__mocks__/*.ts`        | Shared mock implementations |
| `__tests__/setup.test.tsx`        | Global test setup           |

```

```
