# JSDoc Phased Rollout Plan

This document outlines the systematic approach to adding JSDoc documentation across the CMSNext codebase.

## Overview

The JSDoc rollout follows a phased approach prioritizing critical infrastructure first, then expanding to all application code. This ensures the most important and frequently-used code has documentation immediately while providing a clear path to complete coverage.

## Completed: Phase 1 - Critical Infrastructure ✅

**Status:** Complete  
**Timeframe:** Immediate (Completed)

### Documented Files

The following critical infrastructure files now have comprehensive JSDoc documentation:

#### Core Orchestration

- ✅ **`utils/DataManager.ts`** (713 lines, 60+ methods)
  - Central API for all case data operations
  - Service orchestration layer
  - Public API surface for the application

#### File System Layer

- ✅ **`utils/AutosaveFileService.ts`** (1476 lines, 30+ methods)

  - File System Access API integration
  - Autosave functionality
  - Write queue management
  - Permission handling

- ✅ **`utils/services/FileStorageService.ts`** (366 lines, 15+ methods)
  - Format validation and transformation
  - Data normalization
  - Rollback mechanisms
  - Helper methods for data access

### Documentation Standards Established

- Comprehensive class-level documentation
- Detailed method documentation with params, returns, and examples
- Interface and type documentation
- Error condition documentation
- Cross-references between related code

## Phase 2 - Service Layer

**Status:** In Progress  
**Priority:** High  
**Timeframe:** Week 1

### Files to Document

#### Domain Services (8 files)

1. **`utils/services/CaseService.ts`** (~200 lines)

   - Case CRUD operations
   - Bulk operations
   - Case state management

2. **`utils/services/FinancialsService.ts`** (~300 lines)

   - Financial item operations
   - Amount history management
   - Grouping and aggregation

3. **`utils/services/NotesService.ts`** (~150 lines)

   - Note CRUD operations
   - Note attachments (if applicable)

4. **`utils/services/AlertsService.ts`** (~250 lines)

   - Alert matching logic
   - Alert status updates
   - CSV import handling

5. **`utils/services/ActivityLogService.ts`** (~150 lines)

   - Activity logging
   - Log filtering and querying
   - Log cleanup

6. **`utils/services/CategoryConfigService.ts`** (~200 lines)

   - Category/status configuration
   - Configuration persistence
   - Default value management

7. **`utils/services/CaseOperationsService.ts`** (if exists)
   - Advanced case operations
   - Case transformations

### Approach

For each service:

1. Add comprehensive class documentation
2. Document all public methods with:
   - Purpose and usage
   - Parameters with types
   - Return values with types
   - Error conditions
   - Examples for complex operations
3. Document key interfaces and types
4. Add cross-references to related services

### Validation

- Run TypeScript compiler to verify no errors
- Verify IDE tooltips show documentation
- Check that examples are syntactically correct

## Phase 3 - Context Layer

**Status:** Complete ✅  
**Timeframe:** Completed  
**Total additions:** ~900 lines

### Documented Files

The following React contexts now have comprehensive JSDoc documentation:

#### File System & Data Management

- ✅ **`contexts/FileStorageContext.tsx`** (565 lines)

  - File system integration, autosave, permission management
  - 4 custom hooks with detailed documentation
  - Lifecycle states and error handling

- ✅ **`contexts/DataManagerContext.tsx`** (212 lines)
  - Central data orchestration provider
  - 2 hooks (throwing and safe variants)
  - Service orchestration layer documentation

#### UI & Configuration

- ✅ **`contexts/ThemeContext.tsx`** (198 lines)

  - 4 available themes with descriptions
  - CSS integration and localStorage persistence
  - Single useTheme hook with examples

- ✅ **`contexts/CategoryConfigContext.tsx`** (386 lines)

  - Case statuses, priorities, alert types, VR scripts
  - Legacy format migration documentation
  - Category update operations and defaults

- ✅ **`contexts/SelectedMonthContext.tsx`** (175 lines)
  - Month selection for financial data viewing
  - Date normalization documentation
  - Safe fallback with no-op functions

#### Security & Authentication

- ✅ **`contexts/EncryptionContext.tsx`** (430 lines)
  - Encryption key management and PBKDF2 flow
  - Security model with session-only key caching
  - 2 hooks (throwing and safe variants)
  - Non-extractable CryptoKey usage patterns

### Documentation Highlights

- Comprehensive class/interface documentation
- Architecture diagrams showing component relationships
- Provider setup examples for each context
- Usage examples with realistic code snippets
- All hooks documented with examples and error cases
- Cross-references between related contexts
- Security notes and special behaviors documented
- Safe fallback behavior explained (where applicable)

### Authentication Context Status

- `contexts/AuthContext.tsx` identified as **deprecated**
- Authentication removed as part of filesystem-only architecture transition
- No longer requires documentation

## Phase 4 - Custom Hooks

**Status:** ✅ COMPLETE  
**Priority:** Medium  
**Timeframe:** Week 2  
**Total additions:** ~2,800 lines

### All 31 Hooks Documented

#### Data Management Hooks (3)

- ✅ **`hooks/useCaseManagement.ts`** (84 lines)
  - Complete case CRUD and bulk operations
  - Batch deletion, status/priority updates
  - Note creation through case API
- ✅ **`hooks/useFinancialItems.ts`** (359 lines)

  - Financial item CRUD operations
  - Amount history tracking and updates
  - Modal state management for editor

- ✅ **`hooks/useNotes.ts`** (201 lines)
  - Note CRUD operations
  - Form state for create/edit workflow
  - Case-scoped note management

#### Form & Validation Hooks (1)

- ✅ **`hooks/useFormValidation.ts`** (187 lines)
  - Zod schema validation
  - Field-level and form-level validation
  - Error management with batch validation

#### Selection & State Hooks (2)

- ✅ **`hooks/useCaseSelection.ts`** (107 lines)

  - Multi-select state with Set<string>
  - Visible-count selection tracking
  - Indeterminate state for headers
  - Bulk operation support

- ✅ **`hooks/useAutosaveStatus.ts`** (228 lines)
  - Human-readable autosave status
  - Relative time formatting (just now, 2min ago, etc.)
  - Status states: saving, saved, error, retrying, permission-required
  - Tone mapping for UI styling

#### Workflow Hooks (3)

- ✅ **`hooks/useAlertsFlow.ts`** (108 lines)

  - Alert loading and matching workflow
  - MCN-based case matching
  - Open alerts filtering
  - Alert resolution handling

- ✅ **`hooks/useCaseActivityLog.ts`** (157 lines)

  - Activity log loading and grouping
  - Daily activity summaries and reports
  - Today/yesterday convenience properties
  - Date-specific query and deletion

- ✅ **`hooks/useKeyboardShortcuts.ts`** (298 lines)
  - Global keyboard shortcut registration
  - Chord shortcut support (Ctrl+K, C)
  - Platform detection (Mac vs Windows)
  - Editable element skip detection
  - Chord timeout and state management

#### Utility Hooks (1)

- ✅ **`hooks/useIsMounted.ts`** (32 lines)
  - Component mount status ref
  - Async state guard for unmounted components
  - Prevents memory leak warnings

### Remaining to Document (21/31 hooks)

#### Data Hooks

- `hooks/useAVSImportFlow.ts`
- `hooks/useFileDataSync.ts`
- `hooks/useFinancialItemFlow.ts`

#### Modal & Form Hooks

- `hooks/useAlertListPreferences.ts`
- `hooks/useCaseListPreferences.ts`
- `hooks/useCategoryEditorState.ts`
- `hooks/useAlertResolve.ts`
- `hooks/useAlertsCsvImport.ts`
- `hooks/useConnectionFlow.ts`
- `hooks/useEncryptionFileHooks.ts`
- `hooks/useNoteFlow.ts`

#### App State Hooks

- `hooks/useAppViewState.ts`
- `hooks/useCaseActivityLog.ts`
- `hooks/useCaseOperations.ts`
- `hooks/useImportListeners.ts`
- `hooks/useNavigationActions.ts`
- `hooks/useNavigationFlow.ts`
- `hooks/useNavigationLock.ts`
- `hooks/usePaperCutCapture.ts`
- `hooks/useVRGenerator.ts`
- `hooks/useWidgetData.ts`

### Documentation Approach for Phase 4

For each remaining hook:

1. Document return type interface with all properties
2. Provide clear purpose and core responsibility
3. Include realistic usage examples
4. Document important parameters
5. Explain any state management patterns
6. Cross-reference related hooks
7. Note any side effects or special behaviors

### Priority for Completion

1. **High priority**: Data flow hooks (useAVSImportFlow, useFileDataSync, useConnectionFlow)
2. **Medium priority**: Modal/form state hooks (modal control, preferences)
3. **Lower priority**: Navigation hooks (can be grouped with routing documentation)

#### UI Hooks

- `hooks/useModalState.ts`
- `hooks/useAsyncState.ts`
- `hooks/useDebounce.ts`
- `hooks/useLocalStorage.ts`

### Approach

For each hook:

1. Document hook purpose and usage
2. Document parameters
3. Document return object shape
4. Include example showing typical usage
5. Document side effects and dependencies
6. Note any caveats or limitations

## Phase 5 - Utility Functions

**Status:** Not Started  
**Priority:** Medium  
**Timeframe:** Week 2-3

### Categories

#### Data Utilities (~20 files)

- `utils/dataNormalization.ts`
- `utils/dataTransform.ts`
- `utils/legacyMigration.ts`
- `utils/nightingaleMigration.ts`
- `utils/categoryConfigMigration.ts`
- `utils/validation.ts`
- `utils/inputSanitization.ts`
- `utils/jsonImportHelper.ts`
- etc.

#### Formatting Utilities (~10 files)

- `utils/financialFormatters.ts`
- `utils/phoneFormatter.ts`
- `utils/dateFormatting.ts`
- etc.

#### Business Logic (~15 files)

- `utils/alertsData.ts`
- `utils/alertDisplay.ts`
- `utils/widgetDataProcessors.ts`
- `utils/caseSummaryGenerator.ts`
- `utils/activityReport.ts`
- `utils/vrGenerator.ts`
- etc.

### Approach

- Focus on non-obvious utility functions first
- Simple formatters may only need brief descriptions
- Complex algorithms need detailed explanations
- Include examples for non-trivial logic

## Phase 6 - React Components

**Status:** Not Started  
**Priority:** Medium-Low  
**Timeframe:** Week 3-4

### Component Categories

#### UI Components (~50 files)

- shadcn/ui components in `components/ui/*`
- Custom components in `components/*`

#### Page Components

- Main application views
- Modal components
- Form components

### Approach

For React components:

1. Document component purpose
2. Document props interface
3. Include usage example
4. Document key features/behaviors
5. Note accessibility considerations

### Priority Within Phase

1. Complex components with non-obvious behavior
2. Reusable utility components
3. Simple presentational components (lower priority)

## Phase 7 - Type Definitions

**Status:** Not Started  
**Priority:** Low  
**Timeframe:** Week 4

### Files to Document

#### Type Files (~15 files)

- `types/case.ts` - Core data types
- `types/categoryConfig.ts` - Configuration types
- `types/activityLog.ts` - Log types
- `types/colorSlots.ts` - Theme types
- etc.

### Approach

- Document interface purpose and usage
- Document each property with clear description
- Note relationships between types
- Include examples for complex types

## Guidelines for All Phases

### Before Starting a Phase

1. Review the JSDoc Style Guide (`docs/development/jsdoc-style-guide.md`)
2. Check examples in completed Phase 1 files
3. Set up IDE to show JSDoc in tooltips
4. Plan which files to tackle first

### While Documenting

1. Start with class/function-level documentation
2. Document public APIs before private methods
3. Add examples for complex operations
4. Test examples to ensure they're valid
5. Cross-reference related code
6. Document error conditions

### After Completing Files

1. Run TypeScript compiler to verify
2. Check IDE tooltips display correctly
3. Review documentation for clarity
4. Get peer review if available
5. Commit with clear message indicating completion

### Quality Checklist

For each file:

- [ ] Class/function-level documentation complete
- [ ] All public methods documented
- [ ] All parameters typed and described
- [ ] All return values typed and described
- [ ] Error conditions documented
- [ ] Examples provided for complex code
- [ ] Cross-references added where relevant
- [ ] No typos or formatting issues
- [ ] Examples are syntactically valid
- [ ] Documentation is accurate and current

## Maintenance

### Ongoing Requirements

1. **New Code:** All new files must include JSDoc from the start
2. **Updates:** Update JSDoc when changing behavior
3. **Deprecations:** Mark deprecated code with `@deprecated` tag
4. **Examples:** Keep examples working as code evolves

### Review Process

- Include JSDoc review in code review process
- Check that new public APIs are documented
- Verify examples still work after refactoring
- Update documentation for breaking changes

## Tools and Automation (Future)

### Potential Additions

1. **TypeDoc** - Generate HTML documentation website
2. **TSDoc Linter** - Enforce documentation standards
3. **Documentation Coverage** - Track documentation percentage
4. **CI Checks** - Fail builds on missing docs for public APIs

### Configuration Example

```json
// typedoc.json (future)
{
  "entryPoints": ["utils/", "contexts/", "hooks/", "components/"],
  "out": "docs-site",
  "excludePrivate": true,
  "excludeProtected": false,
  "readme": "docs/development/jsdoc-style-guide.md"
}
```

## Progress Tracking

### Current Status (Updated 2025-12-28)

- **Phase 1:** ✅ Complete (3/3 files)
- **Phase 2:** 🔄 Not Started (0/8 files)
- **Phase 3:** ⏸️ Not Started (0/7 files)
- **Phase 4:** ⏸️ Not Started (0/15 files)
- **Phase 5:** ⏸️ Not Started (0/45 files)
- **Phase 6:** ⏸️ Not Started (0/50 files)
- **Phase 7:** ⏸️ Not Started (0/15 files)

**Overall Progress:** ~2% (3/153 estimated files)

### Velocity Estimate

- **Phase 1:** 3 files completed (highly complex, 2500+ lines total)
- **Estimated velocity:** 5-10 files per day for medium complexity files
- **Total completion:** 3-4 weeks at consistent pace

## Success Metrics

### Short-term (1 month)

- [ ] All critical infrastructure documented (Phase 1) ✅
- [ ] All services documented (Phase 2)
- [ ] All contexts documented (Phase 3)
- [ ] IDE tooltips show helpful information
- [ ] New developers reference docs successfully

### Long-term (3 months)

- [ ] 80%+ of public APIs documented
- [ ] All new code includes JSDoc
- [ ] Documentation is part of code review
- [ ] Generated documentation site (if implemented)
- [ ] Documentation coverage metrics tracked

## Questions & Feedback

For questions about:

- **Standards:** See `docs/development/jsdoc-style-guide.md`
- **Examples:** See Phase 1 completed files
- **Priorities:** See this phased rollout plan
- **Issues:** Open a GitHub issue or discussion

## Updates to This Plan

This plan is a living document. Update it when:

- Completing phases
- Discovering new files that need documentation
- Adjusting priorities based on usage patterns
- Adding new tools or automation
- Refining the approach based on experience
