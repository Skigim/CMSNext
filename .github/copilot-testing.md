# Testing Guidelines

Focus: Unit tests, integration tests, mocking patterns.

## Stack

- **Runner:** Vitest (`vitest.config.ts`)
- **Components:** React Testing Library + `@testing-library/jest-dom`
- **Accessibility:** jest-axe with `toHaveNoViolations()` matcher
- **Setup:** `__tests__/setup.test.tsx`

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

- **Forbidden:** `any`, `ts-ignore`, or loose casting
- **Required:** Use `vi.Mocked<T>` for mocks, ensure mock data conforms to interfaces

### Testing Strategy

- **Prioritize Edge Cases:** Test `null`, `undefined`, empty strings, empty arrays first
- **Isolation:** Tests must not rely on external state or execution order
- **Mocking:** Explicitly mock all external dependencies

## AAA Pattern

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

## Component Testing

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

describe("MyComponent", () => {
  it("renders correctly", () => {
    // ARRANGE
    render(<MyComponent data={mockData} />);

    // ASSERT
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  it("handles user interaction", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<MyComponent onSubmit={onSubmit} />);

    // ACT
    await user.click(screen.getByRole("button", { name: /submit/i }));

    // ASSERT
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    // ARRANGE
    const { container } = render(<MyComponent />);

    // ACT & ASSERT
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

## Service Testing

```typescript
describe("CaseService", () => {
  let service: CaseService;
  let mockFileService: vi.Mocked<FileStorageService>;

  beforeEach(() => {
    mockFileService = {
      read: vi.fn(),
      write: vi.fn(),
    } as unknown as vi.Mocked<FileStorageService>;

    service = new CaseService(mockFileService);
  });

  it("creates a new case with generated ID", async () => {
    // ARRANGE
    const input = { caseNumber: "123", clientName: "Test" };
    mockFileService.read.mockResolvedValue({ cases: [] });

    // ACT
    const result = await service.create(input);

    // ASSERT
    expect(result.id).toMatch(/^case-/);
    expect(result.caseNumber).toBe("123");
  });
});
```

## Hook Testing

```typescript
import { renderHook, act, waitFor } from "@testing-library/react";

describe("useCaseManagement", () => {
  it("loads cases on mount", async () => {
    // ARRANGE
    const wrapper = ({ children }) => (
      <DataManagerProvider value={mockDataManager}>
        {children}
      </DataManagerProvider>
    );

    // ACT
    const { result } = renderHook(() => useCaseManagement(), { wrapper });

    // ASSERT
    await waitFor(() => {
      expect(result.current.cases).toHaveLength(2);
    });
  });
});
```

## Self-Correction Prompt

Before finalizing tests, ask:

> "If I broke the logic in the source code (e.g., swapped an `if` condition), would this test still pass?"

If YES, the test is too weak. Rewrite it to be stricter.

## File Locations

- **Test files:** `__tests__/*` (mirrors source structure)
- **Mocks:** `__tests__/__mocks__/*`
- **Setup:** `__tests__/setup.test.tsx`
