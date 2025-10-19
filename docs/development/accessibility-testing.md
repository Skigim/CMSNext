# Accessibility Testing Guide

## Overview

This guide covers accessibility testing practices for the CMSNext case management platform. We aim for **WCAG 2.1 AA compliance** across all user-facing features.

## Core Principles

- **Perceivable**: Information must be presentable to users in ways they can perceive
- **Operable**: Users must be able to operate the interface via keyboard, mouse, or assistive technology
- **Understandable**: Information and user interface operations must be understandable
- **Robust**: Content must work reliably with assistive technologies and across browsers

## Test Infrastructure

### jest-axe Integration

We use **jest-axe** to programmatically detect accessibility violations in unit and integration tests.

#### Installation

```bash
npm install --save-dev jest-axe @types/jest-axe
```

#### Configuration

The jest-axe matcher is configured in `src/test/setup.ts`:

```typescript
import 'jest-axe/extend-expect'
```

#### Basic Usage

```typescript
import { axe, toHaveNoViolations } from 'jest-axe'
import { render } from '@testing-library/react'

expect.extend(toHaveNoViolations)

it('has no accessibility violations', async () => {
  const { container } = render(<YourComponent />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### Test Organization

Accessibility tests should be organized by functional area:

- **Navigation tests**: Focus on `aria-label`, landmark roles (`navigation`, `main`, `complementary`)
- **Form tests**: Verify `aria-labelledby`, `aria-describedby`, required indicators
- **Dialog tests**: Check focus management, `aria-modal`, `role="alertdialog"`
- **Dynamic content tests**: Verify `aria-live`, `aria-busy` for loading states

## WCAG 2.1 AA Compliance Checklist

### Principle 1: Perceivable

- [ ] **1.1 Text Alternatives**: All images have `alt` text or `aria-label`. Decorative images use `aria-hidden="true"`
- [ ] **1.3 Adaptable**: Content structure uses semantic HTML (`<section>`, `<article>`, `<header>`, `<footer>`)
- [ ] **1.4 Distinguishable**: Text has sufficient contrast (4.5:1 for normal text, 3:1 for large text)

### Principle 2: Operable

- [ ] **2.1 Keyboard Accessible**: All functionality accessible via keyboard. Tab order is logical
- [ ] **2.4 Navigable**: Navigation is consistent. Links have descriptive text. Focus is visible
- [ ] **2.5 Input Modalities**: Touch targets are at least 44×44 CSS pixels. No keyboard traps

### Principle 3: Understandable

- [ ] **3.1 Readable**: Page language declared with `lang` attribute. Text is clear and simple
- [ ] **3.2 Predictable**: Navigation is consistent. Form behavior is predictable
- [ ] **3.3 Input Assistance**: Error messages are clear. Labels/instructions provided

### Principle 4: Robust

- [ ] **4.1 Compatible**: Valid HTML. ARIA attributes used correctly. Errors caught in console

## Testing Patterns

### ARIA Labels

Always use `aria-label` or `aria-labelledby` on interactive elements without visible text:

```tsx
// ✅ Good
<button aria-label="Close dialog">
  <X className="h-4 w-4" />
</button>

// ❌ Bad
<button>
  <X className="h-4 w-4" />
</button>
```

### Keyboard Navigation

Test keyboard navigation with `@testing-library/user-event`:

```typescript
import userEvent from '@testing-library/user-event'

it('supports keyboard navigation', async () => {
  const user = userEvent.setup()
  render(<Navigation />)
  
  // Tab through elements
  await user.tab()
  expect(screen.getByRole('link', { name: /home/i })).toHaveFocus()
  
  await user.tab()
  expect(screen.getByRole('link', { name: /about/i })).toHaveFocus()
  
  // Activate with Enter
  await user.keyboard('{Enter}')
})
```

### Focus Management

Verify focus management in modals and dialogs:

```typescript
it('traps focus in modal', async () => {
  const user = userEvent.setup()
  render(<Modal isOpen />)
  
  const modal = screen.getByRole('alertdialog')
  expect(modal).toHaveAttribute('aria-modal', 'true')
  
  // Focus should start on first focusable element
  const closeButton = screen.getByRole('button', { name: /close/i })
  expect(closeButton).toHaveFocus()
})
```

### ARIA Attributes

Verify presence and correctness of ARIA attributes:

```typescript
it('has proper ARIA attributes', () => {
  render(<CaseForm />)
  
  const nameInput = screen.getByLabelText(/case name/i)
  expect(nameInput).toHaveAttribute('aria-required', 'true')
  
  const status = screen.getByRole('combobox', { name: /status/i })
  expect(status).toHaveAttribute('aria-expanded', 'false')
})
```

### Live Regions

For dynamic content updates, use `aria-live`:

```tsx
// ✅ Good
<div aria-live="polite" aria-atomic="true">
  {loadingMessage}
</div>

// ❌ Bad - users won't know content updated
<div>{loadingMessage}</div>
```

Test live regions:

```typescript
it('announces dynamic updates', async () => {
  render(<CaseList />)
  
  const liveRegion = screen.getByRole('status')
  expect(liveRegion).toHaveAttribute('aria-live', 'polite')
  
  fireEvent.click(screen.getByRole('button', { name: /load more/i }))
  
  await waitFor(() => {
    expect(liveRegion).toHaveTextContent(/loaded 10 more cases/i)
  })
})
```

## Component Accessibility Requirements

### Forms

- [ ] All `<input>`, `<select>`, `<textarea>` must have associated `<label>`
- [ ] Required fields marked with `aria-required="true"`
- [ ] Error messages linked with `aria-describedby`
- [ ] Form submission accessible without JavaScript

Example:

```tsx
<label htmlFor="mcn">MCN <span aria-label="required">*</span></label>
<input
  id="mcn"
  aria-required="true"
  aria-describedby="mcn-error"
/>
<div id="mcn-error" role="alert">
  MCN is required
</div>
```

### Tables

- [ ] Use `<table>` semantics with `<thead>`, `<tbody>`, `<tfoot>`
- [ ] Header cells use `<th scope="col">`
- [ ] Complex tables have `<caption>` or `aria-label`

### Modals/Dialogs

- [ ] `role="alertdialog"` or `role="dialog"`
- [ ] `aria-modal="true"`
- [ ] `aria-labelledby` points to dialog title
- [ ] Focus trapped and returned on close
- [ ] Escape key closes the dialog

### Navigation

- [ ] Use `<nav>` with `aria-label` when multiple navs
- [ ] Current page indicated with `aria-current="page"`
- [ ] Skip links available for keyboard users

## Common Violations & Fixes

### "Heading levels should only increase by one"

**Problem**: `<h1>` followed by `<h4>` (skips h2, h3)

**Fix**:
```tsx
// ❌ Bad
<h1>Dashboard</h1>
<h4>Activity Report</h4>  // Should be h2 or h3

// ✅ Good
<h1>Dashboard</h1>
<h2>Insights</h2>
<h3>Activity Report</h3>
```

### "Buttons must have discernible text"

**Problem**: Button with only an icon, no accessible label

**Fix**:
```tsx
// ❌ Bad
<button>
  <X className="h-4 w-4" />
</button>

// ✅ Good
<button aria-label="Close">
  <X className="h-4 w-4" />
</button>
```

### "Interactive controls must not be nested"

**Problem**: Button inside another button or div with `role="button"`

**Fix**:
```tsx
// ❌ Bad
<div role="button">
  <button>Edit</button>
</div>

// ✅ Good
<div>
  <button>Edit</button>
</div>
```

### "Form elements must have labels"

**Problem**: Input without associated label

**Fix**:
```tsx
// ❌ Bad
<input type="text" placeholder="Name" />

// ✅ Good
<label htmlFor="name">Name</label>
<input id="name" type="text" />
```

## Accessibility in shadcn/ui Components

The CMSNext project uses shadcn/ui, which provides accessible primitives. Ensure proper usage:

### Select

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

<Select>
  <SelectTrigger id="status" aria-label="Case status">
    <SelectValue placeholder="Select status..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="pending">Pending</SelectItem>
    <SelectItem value="approved">Approved</SelectItem>
  </SelectContent>
</Select>
```

### Dialog

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit Case</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### Button

```tsx
// For icon-only buttons, always provide aria-label
<Button size="sm" variant="ghost" aria-label="Delete case">
  <Trash2 className="h-4 w-4" />
</Button>
```

## Test Coverage by Feature

### Case Management

Files to test:
- `components/case/CaseForm.tsx`
- `components/case/CaseDetails.tsx`
- `components/case/NotesSection.tsx`

Accessibility focus:
- Form navigation and submission
- Table accessibility (case list)
- Note creation/editing workflows

### Financial Management

Files to test:
- `components/financial/FinancialItemCard.tsx`
- `components/financial/FinancialItemCardActions.tsx`

Accessibility focus:
- Income/expense form fields
- Card action buttons
- Status indicators

### Dashboard

Files to test:
- `components/app/Dashboard.tsx`
- `components/app/ActivityReportCard.tsx`

Accessibility focus:
- Heading hierarchy
- Alert announcements
- Report export controls

### Navigation

Files to test:
- `components/app/AppNavigationShell.tsx`
- `components/routing/*`

Accessibility focus:
- Keyboard navigation
- Current page indication
- Skip links (if implemented)

## Remediation Workflow

When accessibility violations are found:

1. **Identify**: Use jest-axe and browser DevTools to identify the violation
2. **Document**: Add a comment noting the violation type and WCAG criterion
3. **Remediate**: Fix the issue following this guide
4. **Test**: Verify the fix with jest-axe and manual testing
5. **Review**: Ensure no regressions in related features

## CI Integration

Accessibility tests are run as part of the standard test suite:

```bash
npm test
```

To run only accessibility tests:

```bash
npm test -- --grep "accessibility|ARIA|keyboard"
```

## Browser Testing

Test across browsers with different assistive technologies:

- **Chrome** + NVDA (Windows)
- **Firefox** + NVDA (Windows)
- **Safari** + VoiceOver (macOS)
- **Safari** + VoiceOver (iOS)

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [jest-axe Documentation](https://github.com/nickcolley/jest-axe)
- [Radix UI Accessibility](https://www.radix-ui.com/docs/primitives/overview/accessibility)
- [shadcn/ui Component Docs](https://ui.shadcn.com/)

## Accessibility Testing Tools

- **jest-axe**: Automated axe-core tests in React components
- **axe DevTools**: Browser extension for manual testing
- **WAVE**: Browser extension for semantic structure validation
- **Lighthouse**: Built-in Chrome DevTools accessibility audits
- **NVDA**: Free screen reader for Windows
- **JAWS**: Commercial screen reader (trial available)
- **VoiceOver**: Built-in macOS/iOS screen reader

## Questions & Support

For accessibility questions:
1. Check this guide and the resources linked
2. Review existing test patterns in `__tests__/components/`
3. Consult the WCAG guidelines for specific criteria
4. Raise issues documenting the accessibility concern
