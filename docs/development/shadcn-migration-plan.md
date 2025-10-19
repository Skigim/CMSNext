# Shadcn/UI Migration Work Plan

**Status:** 1/7 Complete (14%)  
**Last Updated:** October 15, 2025

## Overview

This document provides a parallelizable work plan for migrating remaining components from custom CSS to shadcn/ui primitives. Each track can be executed independently to enable simultaneous work by multiple agents or developers.

---

## ✅ Completed

### Track 0: Financial Components ✓
**Status:** Complete  
**Completed:** October 15, 2025  
**Components:**
- `components/financial/FinancialItemCard.tsx`
- `components/financial/FinancialItemCardActions.tsx`
- `components/financial/FinancialItemCardHeader.tsx`
- `components/financial/FinancialItemCardMeta.tsx`
- `components/financial/FinancialItemSaveIndicator.tsx`

**Outcomes:**
- Migrated to `Card`, `CardHeader`, `CardContent`, `Button`, `Collapsible`
- Removed 45+ lines of custom CSS from `globals.css`
- Added proper accessibility attributes (ARIA labels, keyboard navigation)
- Full Tailwind v4 design token compliance

---

## 🚧 Remaining Work

### Track 1: Diagnostics Components
**Priority:** Medium  
**Estimated Effort:** 2-3 hours  
**Dependencies:** None  
**Can Run in Parallel:** ✅ Yes

#### Components
- `components/diagnostics/FileStorageDiagnostics.tsx`

#### Current State Analysis
```bash
# Check current implementation
grep -r "className" components/diagnostics/FileStorageDiagnostics.tsx
```

#### Migration Tasks
1. **Wrap diagnostic sections with shadcn `Card`**
   - Replace custom container divs with `Card`, `CardHeader`, `CardContent`
   - Use `CardTitle` for section headings

2. **Convert buttons to shadcn `Button`**
   - Replace custom button styles with `Button` component
   - Apply appropriate variants (`default`, `outline`, `ghost`)

3. **Replace status indicators with `Badge`**
   - Convert inline status spans to shadcn `Badge`
   - Use semantic variants: `default`, `secondary`, `destructive`, `success`

4. **Update typography**
   - Ensure compliance with Tailwind text utilities
   - Remove any custom font classes

#### Acceptance Criteria
- [ ] All diagnostic sections wrapped in `Card` components
- [ ] All buttons use shadcn `Button` with proper variants
- [ ] Status indicators use shadcn `Badge`
- [ ] No custom CSS classes remain
- [ ] Accessibility: proper ARIA labels, focus management
- [ ] Tests: Update `__tests__/components/diagnostics/FileStorageDiagnostics.test.tsx`

#### Test Commands
```bash
npm test -- FileStorageDiagnostics.test.tsx
npm run build
```

---

### Track 2: App Loading State
**Priority:** High  
**Estimated Effort:** 1-2 hours  
**Dependencies:** None  
**Can Run in Parallel:** ✅ Yes

#### Components
- `components/app/AppLoadingState.tsx`

#### Current State Analysis
```bash
# Check current implementation
cat components/app/AppLoadingState.tsx
```

#### Migration Tasks
1. **Replace spinner with shadcn loader**
   - Option A: Use `Skeleton` component for placeholder effect
   - Option B: Create reusable `Spinner` in `components/ui/spinner.tsx`

2. **Wrap loading state in `Card`**
   - Use `Card` for centered loading container
   - Apply proper spacing with `CardContent`

3. **Add loading message with proper typography**
   - Use Tailwind text utilities
   - Ensure theme compatibility across all six themes

#### Acceptance Criteria
- [ ] Loading spinner uses shadcn primitive or custom `Spinner` component
- [ ] Layout uses `Card` for container
- [ ] No custom CSS classes
- [ ] Proper centering with Tailwind flex utilities
- [ ] Tests: Update `__tests__/components/app/AppLoadingState.test.tsx`

#### Test Commands
```bash
npm test -- AppLoadingState.test.tsx
npm run build
```

---

### Track 3: Connection Onboarding
**Priority:** High  
**Estimated Effort:** 3-4 hours  
**Dependencies:** None  
**Can Run in Parallel:** ✅ Yes

#### Components
- `components/app/ConnectionOnboarding.tsx`

#### Current State Analysis
```bash
# Check current modal implementation
grep -A 10 "export function ConnectionOnboarding" components/app/ConnectionOnboarding.tsx
```

#### Migration Tasks
1. **Convert to shadcn `Dialog` component**
   - Replace custom modal with `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`
   - Ensure proper focus trap and keyboard navigation

2. **Update modal shell/layout**
   - Use `DialogFooter` for action buttons
   - Apply consistent padding with shadcn spacing

3. **Convert buttons to shadcn `Button`**
   - Primary action: `variant="default"`
   - Secondary action: `variant="outline"`

4. **Add proper accessibility**
   - ARIA labels for dialog
   - Focus management on open/close
   - Escape key handling

#### Acceptance Criteria
- [ ] Modal uses shadcn `Dialog` primitives
- [ ] Proper dialog structure: Header, Content, Footer
- [ ] All buttons use shadcn `Button`
- [ ] Accessibility: focus trap, keyboard navigation, ARIA labels
- [ ] No custom CSS classes
- [ ] Tests: Update `__tests__/components/app/ConnectionOnboarding.test.tsx`

#### Test Commands
```bash
npm test -- ConnectionOnboarding.test.tsx
npm run build
```

---

### Track 4: Case Workspace Error States
**Priority:** Medium  
**Estimated Effort:** 2 hours  
**Dependencies:** None  
**Can Run in Parallel:** ✅ Yes

#### Components
- `components/app/CaseWorkspace.tsx`

#### Current State Analysis
```bash
# Check error banner implementation
grep -B 5 -A 10 "error" components/app/CaseWorkspace.tsx
```

#### Migration Tasks
1. **Convert error banner to shadcn `Alert`**
   - Replace custom error div with `Alert` component
   - Use `AlertTitle` and `AlertDescription`
   - Apply `variant="destructive"` for error states

2. **Update error action buttons**
   - Convert to shadcn `Button`
   - Use appropriate variants for primary/secondary actions

3. **Add alert icons**
   - Import and use icons from `lucide-react`
   - Follow shadcn `Alert` patterns

#### Acceptance Criteria
- [ ] Error banners use shadcn `Alert` with `variant="destructive"`
- [ ] Action buttons use shadcn `Button`
- [ ] Proper icon usage from lucide-react
- [ ] No custom CSS classes for error states
- [ ] Tests: Update `__tests__/components/app/CaseWorkspace.test.tsx`

#### Test Commands
```bash
npm test -- CaseWorkspace.test.tsx
npm run build
```

---

### Track 5: Error Fallback Components
**Priority:** Medium  
**Estimated Effort:** 2-3 hours  
**Dependencies:** None  
**Can Run in Parallel:** ✅ Yes

#### Components
- `components/error/ErrorFallback.tsx`

#### Current State Analysis
```bash
# Check error fallback structure
cat components/error/ErrorFallback.tsx
```

#### Migration Tasks
1. **Rebuild error cards with shadcn primitives**
   - Replace custom error container with `Card`, `CardHeader`, `CardContent`, `CardFooter`
   - Use `CardTitle` for error heading

2. **Convert to shadcn `Alert` for error messages**
   - Use `Alert` with `variant="destructive"` for critical errors
   - Use `AlertDescription` for error details

3. **Update action buttons**
   - Convert retry/reload buttons to shadcn `Button`
   - Use appropriate variants

4. **Improve error messaging layout**
   - Use Tailwind spacing utilities
   - Ensure readability across themes

#### Acceptance Criteria
- [ ] Error fallback uses `Card` and/or `Alert` components
- [ ] All buttons use shadcn `Button`
- [ ] Proper error message hierarchy with shadcn typography
- [ ] No custom CSS classes
- [ ] Accessibility: proper error announcements, focus management
- [ ] Tests: Update `__tests__/components/error/ErrorFallback.test.tsx`

#### Test Commands
```bash
npm test -- ErrorFallback.test.tsx
npm run build
```

---

### Track 6: Image Fallback Component
**Priority:** Low  
**Estimated Effort:** 1-2 hours  
**Dependencies:** None  
**Can Run in Parallel:** ✅ Yes

#### Components
- `components/figma/ImageWithFallback.tsx`

#### Current State Analysis
```bash
# Check image fallback implementation
cat components/figma/ImageWithFallback.tsx
```

#### Migration Tasks
1. **Replace custom fallback with shadcn `Skeleton`**
   - Use `Skeleton` component for loading state
   - Match aspect ratio of expected image

2. **Add shadcn `AspectRatio` wrapper**
   - Wrap image in `AspectRatio` component for consistent sizing
   - Maintain responsive behavior

3. **Update fallback icon/placeholder**
   - Use lucide-react icons for fallback state
   - Apply proper sizing and color

#### Acceptance Criteria
- [ ] Loading state uses shadcn `Skeleton`
- [ ] Image wrapped in shadcn `AspectRatio`
- [ ] Fallback state uses consistent Tailwind utilities
- [ ] No custom CSS classes
- [ ] Tests: Update `__tests__/components/figma/ImageWithFallback.test.tsx`

#### Test Commands
```bash
npm test -- ImageWithFallback.test.tsx
npm run build
```

---

## 📋 Final Cleanup Track

**Priority:** Low  
**Estimated Effort:** 1 hour  
**Dependencies:** ALL tracks 1-6 must be complete  
**Can Run in Parallel:** ❌ No (must run last)

### Tasks
1. **Audit `styles/globals.css` for orphaned CSS**
   ```bash
   # Search for unused custom classes
   grep -E "\.[a-z-]+\s*\{" styles/globals.css
   ```

2. **Remove any remaining custom component classes**
   - Verify no components reference removed classes
   - Run full test suite

3. **Update documentation**
   - Mark all items complete in `.github/copilot-instructions.md`
   - Update this file with completion dates

4. **Final validation**
   ```bash
   npm run build
   npm test
   npm run lint
   ```

### Acceptance Criteria
- [ ] No orphaned CSS classes in `globals.css`
- [ ] All tests passing
- [ ] Build successful
- [ ] Linter clean
- [ ] Checklist in `.github/copilot-instructions.md` fully checked

---

## 🎯 Coordination & Handoff

### For Multi-Agent Work
Each track (1-6) can be assigned to different agents/developers simultaneously. To coordinate:

1. **Claim a track** by creating a feature branch:
   ```bash
   git checkout -b shadcn/track-N-component-name
   ```

2. **Open a draft PR** to signal work in progress

3. **Complete acceptance criteria** before marking ready for review

4. **Merge order doesn't matter** - tracks are independent

### For GitHub Copilot Coding Agent
Each track can be handed off using the prompts below. Copy the prompt for your desired track and use it with `#github-pull-request_copilot-coding-agent`.

#### Ready-to-Use Prompts

**Track 1: Diagnostics Components**
```
#github-pull-request_copilot-coding-agent

Title: Migrate FileStorageDiagnostics to shadcn/ui

Description:
Migrate components/diagnostics/FileStorageDiagnostics.tsx to use shadcn/ui primitives following Track 1 in docs/development/shadcn-migration-plan.md.

Tasks:
1. Wrap diagnostic sections with shadcn Card (Card, CardHeader, CardContent, CardTitle)
2. Convert all buttons to shadcn Button with appropriate variants
3. Replace status indicators with shadcn Badge (use semantic variants: default, secondary, destructive, success)
4. Remove all custom CSS classes
5. Add proper ARIA labels and keyboard navigation
6. Update __tests__/components/diagnostics/FileStorageDiagnostics.test.tsx
7. Verify build and tests pass

Acceptance Criteria:
- All diagnostic sections wrapped in Card components
- All buttons use shadcn Button with proper variants
- Status indicators use shadcn Badge
- No custom CSS classes remain
- Accessibility: proper ARIA labels, focus management
- Tests updated and passing
- Build successful

Test Commands:
npm test -- FileStorageDiagnostics.test.tsx
npm run build
```

**Track 2: App Loading State**
```
#github-pull-request_copilot-coding-agent

Title: Migrate AppLoadingState to shadcn/ui

Description:
Migrate components/app/AppLoadingState.tsx to use shadcn/ui primitives following Track 2 in docs/development/shadcn-migration-plan.md.

Tasks:
1. Replace custom spinner with shadcn Skeleton component OR create reusable Spinner in components/ui/spinner.tsx
2. Wrap loading state in Card component
3. Use CardContent for proper spacing
4. Add loading message with Tailwind text utilities
5. Ensure theme compatibility across all six themes (light, dark, soft-dark, warm, blue, paper)
6. Remove all custom CSS classes
7. Update __tests__/components/app/AppLoadingState.test.tsx
8. Verify build and tests pass

Acceptance Criteria:
- Loading spinner uses shadcn primitive or custom Spinner component
- Layout uses Card for container
- No custom CSS classes
- Proper centering with Tailwind flex utilities
- Theme compatibility verified
- Tests updated and passing
- Build successful

Test Commands:
npm test -- AppLoadingState.test.tsx
npm run build
```

**Track 3: Connection Onboarding**
```
#github-pull-request_copilot-coding-agent

Title: Migrate ConnectionOnboarding to shadcn/ui Dialog

Description:
Migrate components/app/ConnectionOnboarding.tsx to use shadcn/ui Dialog primitives following Track 3 in docs/development/shadcn-migration-plan.md.

Tasks:
1. Replace custom modal with shadcn Dialog (Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription)
2. Ensure proper focus trap and keyboard navigation
3. Use DialogFooter for action buttons
4. Convert buttons to shadcn Button (primary: variant="default", secondary: variant="outline")
5. Add proper accessibility (ARIA labels, focus management, escape key handling)
6. Remove all custom CSS classes
7. Update __tests__/components/app/ConnectionOnboarding.test.tsx
8. Verify build and tests pass

Acceptance Criteria:
- Modal uses shadcn Dialog primitives
- Proper dialog structure: Header, Content, Footer
- All buttons use shadcn Button
- Accessibility: focus trap, keyboard navigation, ARIA labels
- No custom CSS classes
- Tests updated and passing
- Build successful

Test Commands:
npm test -- ConnectionOnboarding.test.tsx
npm run build
```

**Track 4: Case Workspace Error States**
```
#github-pull-request_copilot-coding-agent

Title: Migrate CaseWorkspace error states to shadcn/ui

Description:
Migrate error banners in components/app/CaseWorkspace.tsx to use shadcn/ui Alert primitives following Track 4 in docs/development/shadcn-migration-plan.md.

Tasks:
1. Convert error banner to shadcn Alert with variant="destructive"
2. Use AlertTitle and AlertDescription for error content
3. Update error action buttons to shadcn Button
4. Add alert icons from lucide-react
5. Follow shadcn Alert patterns
6. Remove all custom CSS classes for error states
7. Update __tests__/components/app/CaseWorkspace.test.tsx
8. Verify build and tests pass

Acceptance Criteria:
- Error banners use shadcn Alert with variant="destructive"
- Action buttons use shadcn Button
- Proper icon usage from lucide-react
- No custom CSS classes for error states
- Tests updated and passing
- Build successful

Test Commands:
npm test -- CaseWorkspace.test.tsx
npm run build
```

**Track 5: Error Fallback Components**
```
#github-pull-request_copilot-coding-agent

Title: Migrate ErrorFallback to shadcn/ui

Description:
Migrate components/error/ErrorFallback.tsx to use shadcn/ui Card and Alert primitives following Track 5 in docs/development/shadcn-migration-plan.md.

Tasks:
1. Rebuild error cards with shadcn primitives (Card, CardHeader, CardContent, CardFooter, CardTitle)
2. Use Alert with variant="destructive" for critical errors
3. Use AlertDescription for error details
4. Convert retry/reload buttons to shadcn Button with appropriate variants
5. Improve error messaging layout using Tailwind spacing utilities
6. Ensure readability across all themes
7. Add proper accessibility (error announcements, focus management)
8. Remove all custom CSS classes
9. Update __tests__/components/error/ErrorFallback.test.tsx
10. Verify build and tests pass

Acceptance Criteria:
- Error fallback uses Card and/or Alert components
- All buttons use shadcn Button
- Proper error message hierarchy with shadcn typography
- No custom CSS classes
- Accessibility: proper error announcements, focus management
- Tests updated and passing
- Build successful

Test Commands:
npm test -- ErrorFallback.test.tsx
npm run build
```

**Track 6: Image Fallback Component**
```
#github-pull-request_copilot-coding-agent

Title: Migrate ImageWithFallback to shadcn/ui

Description:
Migrate components/figma/ImageWithFallback.tsx to use shadcn/ui Skeleton and AspectRatio primitives following Track 6 in docs/development/shadcn-migration-plan.md.

Tasks:
1. Replace custom fallback with shadcn Skeleton component
2. Match aspect ratio of expected image
3. Wrap image in shadcn AspectRatio component for consistent sizing
4. Maintain responsive behavior
5. Update fallback icon/placeholder using lucide-react icons
6. Apply proper sizing and color with Tailwind utilities
7. Remove all custom CSS classes
8. Update __tests__/components/figma/ImageWithFallback.test.tsx
9. Verify build and tests pass

Acceptance Criteria:
- Loading state uses shadcn Skeleton
- Image wrapped in shadcn AspectRatio
- Fallback state uses consistent Tailwind utilities
- No custom CSS classes
- Tests updated and passing
- Build successful

Test Commands:
npm test -- ImageWithFallback.test.tsx
npm run build
```

---

## 📊 Progress Tracking

| Track | Component | Status | Assignee | Branch | PR |
|-------|-----------|--------|----------|--------|-----|
| 0 | Financial Components | ✅ Complete | - | main | #27 |
| 1 | Diagnostics | ⬜ Not Started | - | - | - |
| 2 | App Loading State | ⬜ Not Started | - | - | - |
| 3 | Connection Onboarding | ⬜ Not Started | - | - | - |
| 4 | Case Workspace | ⬜ Not Started | - | - | - |
| 5 | Error Fallback | ⬜ Not Started | - | - | - |
| 6 | Image Fallback | ⬜ Not Started | - | - | - |
| Final | Cleanup | ⬜ Not Started | - | - | - |

---

## 🛠️ Development Guidelines

### Shadcn/UI Conventions
- Always import from `components/ui/*`
- Use semantic variants: `default`, `destructive`, `outline`, `ghost`, `secondary`
- Maintain accessibility: ARIA labels, keyboard navigation, focus management
- Follow Tailwind v4 design tokens (no hardcoded colors)

### Testing Requirements
- Update corresponding test files for each component
- Maintain or improve test coverage
- Run component tests before committing
- Verify across all six themes (light, dark, soft-dark, warm, blue, paper)

### Code Review Checklist
- [ ] No custom CSS classes introduced
- [ ] All shadcn imports from `components/ui/*`
- [ ] Proper TypeScript types
- [ ] Accessibility attributes present
- [ ] Tests updated and passing
- [ ] Build successful
- [ ] Theme compatibility verified

---

## 📚 References

- **Shadcn/UI Docs:** https://ui.shadcn.com/
- **Tailwind v4:** https://tailwindcss.com/
- **Lucide Icons:** https://lucide.dev/
- **Project Architecture:** `docs/development/feature-catalogue.md`
- **Testing Guide:** `docs/development/testing-infrastructure.md`

---

## 🔄 Updates Log

| Date | Update | Author |
|------|--------|--------|
| 2025-10-15 | Initial work plan created | AI Agent |
| 2025-10-15 | Track 0 (Financial) marked complete | AI Agent |
