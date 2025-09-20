# CMSNext - AI Coding Agent Instructions

## Project Overview
This is a **filesystem-only** case management platform built with React 18 + TypeScript that uses the File System Access API for local data persistence. No databases, authentication, or servers required.

## Core Architecture Principles

### 1. Filesystem-Only Storage (Critical)
- **ALWAYS use file storage** - no API switching or database access
- All data operations go through `fileDataProvider.getAPI()`
- Never hardcode storage choices or mix storage systems

```typescript
// ✅ Correct pattern
const dataAPI = fileDataProvider.getAPI();
if (!dataAPI) {
  setError('Data storage is not available');
  return;
}

// ❌ Never do this
const API_ENABLED = false;
const dataAPI = API_ENABLED ? caseApi : fileStorageAPI;
```

### 2. Data Flow Pattern
- All CRUD operations → `FileStorageAPI` → `AutosaveFileService` → File System Access API
- UI state updates immediately for responsiveness
- File system updates asynchronously via autosave (5s debounce)
- Use `safeNotifyFileStorageChange()` after data mutations

### 3. Context-Based State Management
Three main contexts power the application:
- `FileStorageContext` - File system operations and permissions
- `ThemeContext` - 6 themes (Light, Dark, Soft Dark, Warm, Blue, Paper)
- No auth context (filesystem-only architecture)

## Key Development Patterns

### Data Operations
```typescript
// Standard CRUD pattern
const handleSaveCase = useCallback(async (caseData) => {
  const dataAPI = getDataAPI();
  if (!dataAPI) {
    toast.error('Data storage is not available');
    return;
  }
  
  const toastId = toast.loading("Saving case...");
  try {
    const result = await dataAPI.createCompleteCase(caseData);
    setCases(prev => [...prev, result]);
    toast.success("Case saved successfully", { id: toastId });
    safeNotifyFileStorageChange();
  } catch (err) {
    console.error('Failed to save case:', err);
    toast.error("Failed to save case", { id: toastId });
  }
}, []);
```

### Component Architecture
- Use `memo()` for expensive components to prevent re-renders
- Memoize selectors: `useMemo(() => cases.find(c => c.id === selectedId), [cases, selectedId])`
- Follow shadcn/ui patterns for new components
- Toast notifications with Sonner for all user feedback

### File System Integration Critical Points
- Check `isSupported` before attempting file operations
- Handle permissions gracefully with `ConnectToExistingModal`
- Use batch mode for bulk operations: `startBatchMode()` / `endBatchMode()`
- Always handle `AbortError` (user cancellation) without error toasts

## Directory Structure & Key Files

### Core Data Layer
- `utils/fileDataProvider.ts` - Global data provider singleton
- `utils/fileStorageAPI.ts` - All CRUD operations
- `utils/AutosaveFileService.ts` - File system integration
- `contexts/FileStorageContext.tsx` - React integration

### Component Patterns
- `components/ui/` - shadcn/ui base components (import from here)
- `components/MainLayout.tsx` - Layout with sidebar navigation
- Modal components: `*Modal.tsx` pattern
- Form components: `*Form.tsx` pattern

### Data Types (Critical Reference)
- `types/case.ts` - Complete type definitions
- Main entity: `CaseDisplay` (combines `Person` + `CaseRecord`)
- Financial categories: `'resources' | 'income' | 'expenses'`
- Note categories: `'General' | 'VR Update' | 'Client Contact' | 'Follow-up'`

## Common Tasks & Patterns

### Adding New Fields
1. Update interfaces in `types/case.ts`
2. Modify form components in `components/`
3. Update CRUD operations in `fileStorageAPI.ts`
4. No migration needed (handled automatically)

### New Components
```typescript
// Use this pattern for new components
import { memo, useCallback } from 'react';
import { Button } from './ui/button';
import { toast } from 'sonner';

const NewComponent = memo(function NewComponent({ data, onUpdate }) {
  const handleAction = useCallback(async () => {
    const toastId = toast.loading("Processing...");
    try {
      // Implementation
      toast.success("Success!", { id: toastId });
    } catch (err) {
      toast.error("Failed to process", { id: toastId });
    }
  }, []);

  return (
    <div className="space-y-4">
      <Button onClick={handleAction}>Action</Button>
    </div>
  );
});
```

### Import/Export Operations
- Use `JsonUploader` component for file imports
- Validate with `validateImportData()` before processing
- Use bulk operations for multiple records
- Always create timestamped backups

## Critical Anti-Patterns
- ❌ Don't use localStorage or sessionStorage for case data
- ❌ Don't implement authentication or user management
- ❌ Don't add database dependencies or API calls
- ❌ Don't use `alert()` - always use toast notifications
- ❌ Don't modify state without calling `safeNotifyFileStorageChange()`

## Browser Compatibility & Error Handling
- Requires File System Access API (Chrome 86+, Edge 86+, Opera 72+)
- Show compatibility message for unsupported browsers (Firefox, Safari)
- Handle permission states: `'granted' | 'denied' | 'prompt'`
- Graceful degradation when API unavailable

## Build & Development
- Vite-based development server: `npm run dev`
- TypeScript strict mode enabled
- Tailwind CSS v4 with custom design tokens
- No additional build steps or server setup required
- Do NOT launch dev servers without first checking if a usable server is already running

When implementing new features, prioritize file system integration, maintain the existing architectural patterns, and ensure all data operations flow through the established data provider system.