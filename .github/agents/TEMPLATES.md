# Agent Delegation Templates

Ready-to-use prompt templates for delegating tasks to subagents. Copy and customize these when dispatching agents.

---

## Research Tasks

### Audit Code Pattern

```
TASK: Research only - do not make changes.

Read .github/agents/[AREA].md for context.

Search the codebase for all usages of [PATTERN/FUNCTION/CLASS].

For each usage found, document:
1. File path and line number
2. What the code is trying to accomplish
3. Whether it follows the project patterns
4. Any issues or improvements needed

Return a structured report as markdown.
```

### Investigate Bug

```
TASK: Research only - do not make changes.

There is a bug where [DESCRIPTION].

Steps to investigate:
1. Search for related code using keywords: [KEYWORDS]
2. Read .github/agents/[AREA].md for expected patterns
3. Trace the data flow from [START] to [END]
4. Identify where the bug might originate
5. List potential fixes

Return findings with file paths and line numbers.
```

### Find Similar Patterns

```
TASK: Research only - do not make changes.

Find all instances of [PATTERN] in the codebase.

For example: [EXAMPLE_CODE]

Return:
- File paths and line numbers
- Whether each instance follows best practices
- Any inconsistencies between instances
```

---

## Implementation Tasks

### Add New Service Method

```
TASK: Implement a new service method.

Read .github/agents/SERVICES.md for patterns.

Add to [SERVICE_NAME]:
- Method: [METHOD_NAME]
- Purpose: [DESCRIPTION]
- Parameters: [PARAMS]
- Returns: [TYPE]

Requirements:
- Follow read-modify-write pattern
- Call safeNotifyFileStorageChange() after mutations
- Log activity through ActivityLogService
- Add proper JSDoc documentation
- Build must pass: npm run build

Return the method implementation.
```

### Create New Hook

```
TASK: Create a new custom hook.

Read .github/agents/HOOKS.md for patterns.

Hook: use[FEATURE_NAME]
Location: hooks/use[FEATURE_NAME].ts

Requirements:
- Target 40-50 lines max
- Get services from DataManagerContext
- Use useCallback for all handlers
- Handle loading/error states
- Show toast notifications for errors

Return the hook implementation.
```

### Add Unit Tests

```
TASK: Write unit tests for [MODULE].

Read .github/agents/TESTING.md for patterns.

Target file: [SOURCE_FILE]
Test file: [TEST_FILE]

Write tests covering:
- [FUNCTION_1]: happy path and edge cases
- [FUNCTION_2]: edge cases (null, undefined, empty)
- Error handling scenarios

Requirements:
- Use AAA pattern with comments
- No lazy assertions (no toBeTruthy/toBeDefined)
- Use vi.Mocked<T> for mocks
- All tests must pass: npm test

Return test file content.
```

### Add Component Tests

```
TASK: Write component tests for [COMPONENT].

Read .github/agents/TESTING.md for patterns.

Component: [COMPONENT_PATH]
Test file: [TEST_FILE_PATH]

Write tests covering:
- Renders correctly with props
- User interactions (click, input)
- Loading and error states
- Accessibility (axe check)

Requirements:
- Use React Testing Library
- Use userEvent over fireEvent
- Include axe accessibility check
- All tests must pass: npm test

Return test file content.
```

---

## UI Tasks

### Add New Component

```
TASK: Create a new React component.

Read .github/agents/UI.md for patterns.

Component: [NAME]
Location: components/[FOLDER]/[NAME].tsx

Requirements:
- Use shadcn/ui primitives (Card, Button, etc.)
- Tailwind CSS for styling
- Use hooks for data/actions (never import services)
- Include loading/error states
- Support all themes

Props:
- [PROP_1]: [TYPE] - [DESCRIPTION]
- [PROP_2]: [TYPE] - [DESCRIPTION]

Return the component implementation.
```

### Add Modal Dialog

```
TASK: Create a new modal dialog.

Read .github/agents/UI.md for Dialog patterns.

Modal: [NAME]Dialog
Location: components/modals/[NAME]Dialog.tsx

Requirements:
- Use shadcn Dialog components
- Include DialogTitle and DialogDescription (accessibility)
- Cancel and Submit buttons in DialogFooter
- Show loading state during submit
- Toast notifications for success/error

Props:
- open: boolean
- onOpenChange: (open: boolean) => void
- onSubmit: ([DATA_TYPE]) => Promise<void>

Return the component implementation.
```

### Add Form Component

```
TASK: Create a form component.

Read .github/agents/UI.md for patterns.

Form: [NAME]Form
Location: components/forms/[NAME]Form.tsx

Fields:
- [FIELD_1]: [TYPE] - [VALIDATION]
- [FIELD_2]: [TYPE] - [VALIDATION]

Requirements:
- Use shadcn form components (Input, Select, etc.)
- Use useFormValidation hook for validation
- Show field-level errors
- Disable submit when invalid
- Loading state during submission

Return the component implementation.
```

---

## Refactoring Tasks

### Migrate to New Pattern

```
TASK: Refactor code to follow updated pattern.

Read .github/agents/[AREA].md for target patterns.

Current pattern: [OLD_PATTERN]
Target pattern: [NEW_PATTERN]

Files to update:
- [FILE_1]
- [FILE_2]

For each file:
1. Find usages of old pattern
2. Replace with new pattern
3. Verify types are correct
4. Ensure build passes

Return summary of changes.
```

### Extract Hook from Component

```
TASK: Extract logic from component into custom hook.

Read .github/agents/HOOKS.md for patterns.

Component: [COMPONENT_PATH]
New hook: hooks/use[FEATURE].ts

Extract:
- [STATE_LOGIC] into hook state
- [HANDLER_LOGIC] into useCallback handlers
- [EFFECT_LOGIC] into useEffect

Requirements:
- Hook should be 40-50 lines max
- Component should only have UI rendering after extraction
- Build and tests must pass

Return both the hook and updated component.
```

---

## Verification Checklist

Always include in implementation tasks:

```
VERIFICATION:
- [ ] npm run build passes
- [ ] npm test passes
- [ ] npx tsc --noEmit shows no errors
- [ ] Code follows patterns in .github/agents/[AREA].md
- [ ] JSDoc comments on public APIs

Return verification status.
```

---

## Quick Prompts

### Fix TypeScript Error

```
TASK: Fix TypeScript error in [FILE].

Error: [ERROR_MESSAGE]

Read the file, understand the context, and fix the type error.
Build must pass: npm run build
```

### Add JSDoc Comments

```
TASK: Add JSDoc documentation to [FILE].

For each exported function/class/interface:
- Add @description
- Add @param for parameters
- Add @returns for return values
- Add @throws if applicable

Return the documented code.
```

### Review for Patterns

```
TASK: Review [FILE] for pattern compliance.

Read .github/agents/[AREA].md for expected patterns.

Check:
- Follows architectural patterns
- No antipatterns present
- Proper error handling
- Appropriate documentation

Return findings and recommendations.
```
