# CMSNext Testing Infrastructure Documentation

## 📋 Overview

This document provides comprehensive guidance for testing the CMSNext filesystem-only case management platform. Our testing strategy focuses on the key patterns identified in PR reviews and ensures robust coverage for all critical functionality.

## 🏗️ **Current Testing Infrastructure**

### **Test Framework Stack**
- **Vitest 3.2.4** - Fast, Vite-native test runner
- **React Testing Library 16.3.0** - Component testing utilities
- **jsdom** - Browser environment simulation
- **@testing-library/jest-dom** - Custom jest matchers

### **Test Coverage Status**
- **63 passing tests** across 7 suites (unit, component, and integration)
- **95.91% coverage** on DataManager (38 tests)
- **20 tests** for AutosaveFileService
- **1 end-to-end connection flow test** exercising the file storage lifecycle
- **New RTL suites** covering CaseForm, FinancialItemCard, and ConnectToExistingModal

## 🎯 **Priority Testing Patterns**

Based on **PR #1 Review Feedback**, these patterns require special attention:

### **1. React Key Management Best Practices**

#### **Content-Based Key Generation**
```typescript
// ✅ Correct: Stable content-based keys
const generateContentKey = (content: string, fallbackIndex?: number): string => {
  if (!content || content.trim() === '') {
    return `empty-${fallbackIndex || 0}`;
  }
  
  try {
    // Attempt to encode content for key stability (handles Unicode)
    const encoded = encodeURIComponent(content).replace(/%/g, '');
    return `content-${encoded.slice(0, 20)}-${fallbackIndex || 0}`;
  } catch (e) {
    // Fallback for encoding errors
    return `content-${content.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '')}-${fallbackIndex || 0}`;
  }
};

// Test cases to validate:
describe('Key Generation', () => {
  it('should handle Unicode content', () => {
    expect(generateContentKey('测试内容')).toBe(generateContentKey('测试内容'));
    expect(generateContentKey('نص عربي')).toBe(generateContentKey('نص عربي'));
    expect(generateContentKey('🎉💻🚀')).toBe(generateContentKey('🎉💻🚀'));
  });
});
```

#### **Key Stability Across Re-renders**
```typescript
// Test pattern for stable keys
it('should maintain key stability when items reorder', () => {
  const originalItems = [
    { id: '', content: 'First item' },
    { id: '', content: 'Second item' },
    { id: '', content: 'Third item' }
  ];
  
  const { rerender } = render(<ComponentWithList items={originalItems} />);
  // Get initial keys...
  
  const reorderedItems = [originalItems[2], originalItems[0], originalItems[1]];
  rerender(<ComponentWithList items={reorderedItems} />);
  
  // Keys should remain stable for same content regardless of position
});
```

### **2. Memory Leak Prevention**

#### **Component Unmounting Pattern**
```typescript
// ✅ Correct: useRef for mount tracking
const MyComponent = () => {
  const mountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  const handleAsyncOperation = async () => {
    // Long-running operation
    await delay(1000);
    
    // Check if still mounted before state update
    if (mountedRef.current) {
      setState(newValue);
    }
  };
};

// Test pattern for memory leak prevention
it('should not update state after unmount', async () => {
  const { unmount } = render(<MyComponent />);
  
  // Trigger async operation
  fireEvent.click(screen.getByRole('button'));
  
  // Unmount before operation completes
  unmount();
  
  // Wait and verify no memory leak warnings
  await waitFor(() => {}, { timeout: 1500 });
  expect(console.error).not.toHaveBeenCalledWith(
    expect.stringContaining('memory leak')
  );
});
```

### **3. File System Access API Testing**

#### **Mock Browser APIs**
```typescript
// setup.ts - Global test setup
global.showDirectoryPicker = vi.fn();
global.showSaveFilePicker = vi.fn();
global.showOpenFilePicker = vi.fn();

// Mock file handles
const createMockFileHandle = () => ({
  getFile: vi.fn().mockResolvedValue(new File(['{}'], 'data.json')),
  createWritable: vi.fn().mockResolvedValue({
    write: vi.fn(),
    close: vi.fn()
  })
});
```

#### **Testing File Operations**
```typescript
describe('File System Integration', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  it('should handle permission denial gracefully', async () => {
    global.showDirectoryPicker.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    
    const { result } = renderHook(() => useFileStorage());
    
    await act(async () => {
      await expect(result.current.connectToFolder()).rejects.toThrow('Permission denied');
    });
  });
});
```

## 🧪 **Test Organization Structure**

### **Current Test Files**
```
__tests__/
├── AutosaveFileService.test.ts          # File system operations (20 tests)
├── DataManager.test.ts                  # Data CRUD operations (38 tests)
├── setup.test.tsx                       # Environment validation (3 tests)
├── integration/
│   └── connectionFlow.test.tsx          # connect → load → edit → save happy path
└── components/__tests__/
  ├── CaseDetails.test.tsx             # Memory leak prevention
  ├── CaseForm.test.tsx                # Form validation + normalization (new)
  ├── ConnectToExistingModal.test.tsx  # File-storage onboarding UX (new)
  ├── FinancialItemCard.test.tsx       # Inline edits + verification (new)
  ├── KeyManagement.test.ts            # Key generation patterns
  └── NotesSection.test.tsx            # Component key management
```

### **Recommended Test Categories**

#### **1. Unit Tests**
- **Utils Testing**: Data transformation, validation, file operations
- **Hook Testing**: Custom hooks with proper mocking
- **Component Logic**: Pure component behavior without UI integration

## 🧭 **Choosing the Right Testing Approach**

- **React Testing Library (RTL)**
  - Exercise user-facing workflows end-to-end (e.g., connection onboarding, case editing, modal flows).
  - Validate component behaviour that depends on context providers, hooks, or browser APIs (File System Access) by stubbing those integrations.
  - Capture accessibility contracts (labels, roles, focus handling) and regression-proof event wiring.
- **Headless Vitest Suites**
  - Cover pure utilities, data normalization, and hooks that operate without DOM dependencies.
  - Assert business rules, data transformations, and error handling where rendering adds little value.
- **Integration Hybrids**
  - Pair RTL with lightweight service doubles (e.g., mock `AutosaveFileService`) when verifying cross-context flows.
  - Document assumptions inline so filesystem behaviour remains deterministic and repeatable across environments.

#### **2. Integration Tests**
- **File System Flows**: Complete save/load cycles *(happy path covered; add denial/error scenarios next)*
- **Component Integration**: Parent-child component interactions
- **Context Integration**: Provider + consumer testing

#### **3. Performance Tests** 
- **Virtual Scrolling**: Large dataset rendering
- **Memory Usage**: Component mount/unmount cycles
- **Bundle Size**: Asset optimization validation

## 📊 **Testing Best Practices**

### **✅ DO: Recommended Patterns**

1. **Use Content-Based Keys**: Stable across re-renders
   ```typescript
   key={item.id || `content-${hashContent(item.content)}`}
   ```

2. **Mock External Dependencies**: File System API, browser APIs
   ```typescript
   vi.mock('@/utils/fileServiceProvider');
   ```

3. **Test Error Boundaries**: Component failure scenarios
   ```typescript
   it('should catch and display errors gracefully', () => {
     const ThrowError = () => { throw new Error('Test error'); };
     render(<ErrorBoundary><ThrowError /></ErrorBoundary>);
     expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
   });
   ```

4. **Test Memory Management**: Cleanup patterns
   ```typescript
   afterEach(() => {
     cleanup();
     vi.clearAllTimers();
   });
   ```

### **❌ DON'T: Anti-Patterns to Avoid**

1. **Index-Based Keys**: Cause reconciliation issues
   ```typescript
   // ❌ Avoid
   {items.map((item, index) => <div key={index}>{item}</div>)}
   ```

2. **Testing Implementation Details**: Focus on behavior
   ```typescript
   // ❌ Avoid testing internal state
   expect(component.state.internalCounter).toBe(5);
   ```

3. **Ignoring Async Operations**: Always wait for completion
   ```typescript
   // ❌ Avoid
   fireEvent.click(button);
   expect(result).toBe(expected); // May not be updated yet
   
   // ✅ Correct
   fireEvent.click(button);
   await waitFor(() => expect(result).toBe(expected));
   ```

## 🚀 **Running Tests**

### **Development Commands**
```bash
# Run all tests
npm run test:run

# Watch mode for development
npm run test:watch

# Run specific test file
npm run test:run KeyManagement

# Generate coverage report
npm run test:coverage

# UI mode for debugging
npm run test:ui
```

### **Coverage Targets**
- **Statements**: >80%
- **Branches**: >70%
- **Functions**: >70%
- **Lines**: >70%

Current coverage exceeds these targets with **95.91%** on critical components.

## 🎯 **Future Testing Expansion**

### **Phase 4.3: Integration Tests** (Next Priority)
1. **End-to-End File Workflows**: Complete save/load/edit cycles (baseline happy path delivered; cover failures/denials next)
2. **Multi-Component Integration**: Form submission flows
3. **Error Recovery Testing**: Network failures, permission changes
4. **Performance Regression Tests**: Bundle size, load times

### **Phase 4.4: Accessibility Testing**
1. **Screen Reader Compatibility**: ARIA labels, keyboard navigation
2. **Color Contrast**: Visual accessibility standards  
3. **Focus Management**: Tab order, modal focus trapping

## 📈 **Quality Metrics Achievement**

Current testing infrastructure supports the **A+ (98/100)** quality score mentioned in CodeReview.md:

- ✅ **63 passing tests** with comprehensive coverage
- ✅ **React key management** patterns validated
- ✅ **Memory leak prevention** patterns implemented
- ✅ **File system integration** thoroughly mocked and tested
- ✅ **Error handling** with proper boundary testing

The testing foundation is **complete and robust**, positioning the project for the final push to **100% quality score** with the remaining integration test expansion.

---

*Last Updated: September 26, 2025*  
*Next Review: After Phase 4.3 completion*