# Case Tracking Platform - Technical Guidelines

## Architecture Overview

This case tracking platform is a **filesystem-only** application that uses the File System Access API for data persistence. The application has been simplified to remove all development modes, authentication systems, and database dependencies.

## Core Principles

### 1. Filesystem-Only Data Storage
- **Always use file storage** - no API switching or database access
- Data is stored locally using the File System Access API
- Automatic file backup and autosave functionality
- Graceful degradation for unsupported browsers

### 2. Data Access Pattern
All data operations should use the file data provider:

```typescript
// ✅ Correct - Always use file storage
const getDataAPI = () => fileDataProvider.getAPI();

// ❌ Wrong - No more API switching
const getDataAPI = () => isApiEnabled() ? caseApi : fileDataProvider.getAPI();
```

### 3. Component Architecture
- Component-driven architecture using shadcn/UI components
- TypeScript throughout for type safety
- Responsive design with Tailwind CSS v4
- Toast notifications using Sonner for user feedback

## Key Components

### Data Layer
- `FileStorageAPI` - Handles all CRUD operations for cases, notes, and financial items
- `fileDataProvider` - Global provider that manages FileStorageAPI instances
- `AutosaveFileService` - Handles automatic saving and file system integration

### UI Layer
- `MainLayout` - Primary layout with navigation
- `Dashboard` - Overview of cases and quick stats
- `CaseList` - Searchable, filterable list of all cases
- `CaseDetails` - Detailed view of individual cases
- `CaseForm` - Form for creating/editing cases
- `Settings` - Data management, import/export, and app settings

### Storage Integration
- `FileStorageContext` - React context for file system operations
- `ConnectToExistingModal` - Handles directory selection and permissions
- Data synchronization between UI state and file storage

## Development Standards

### TypeScript Usage
- Strict TypeScript configuration
- Proper type definitions in `/types/case.ts`
- No `any` types unless absolutely necessary
- Interface definitions for all data structures

### Error Handling
- Comprehensive error handling with user-friendly messages
- Toast notifications for all operations (success/error)
- Graceful degradation when file system access is unavailable
- Proper error boundaries and fallbacks

### Performance
- Memoized components and callbacks to prevent unnecessary re-renders
- Efficient data loading and caching
- Batch operations for bulk imports
- Optimized autosave with debouncing

## File Structure Standards

### Component Organization
```
/components/
  ├── ui/           # Reusable UI components (shadcn/ui)
  ├── modals/       # Modal components
  ├── forms/        # Form components
  └── sections/     # Section components for case details
```

### Utility Organization
```
/utils/
  ├── fileStorageAPI.ts      # Core file storage operations
  ├── fileDataProvider.ts    # Global data provider
  ├── AutosaveFileService.ts # File system integration
  └── dataTransform.ts       # Data validation and transformation
```

## Data Flow

### Application Startup
1. Check File System Access API support
2. Restore directory permissions if available
3. Show connection modal if setup required
4. Load existing data when connected

### Data Operations
1. All operations go through `fileDataProvider.getAPI()`
2. Changes are automatically saved via autosave
3. UI state is updated immediately for responsiveness
4. File system is updated asynchronously

### Import/Export
1. JSON file import with validation
2. Automatic data migration for legacy formats
3. Export with metadata preservation
4. Bulk operations with progress indicators

## Anti-Patterns to Avoid

### ❌ Hardcoded Storage Choices
```typescript
// Wrong - don't hardcode storage type
const API_ENABLED = false;
const dataAPI = API_ENABLED ? caseApi : localStorageAPI;
```

### ❌ Mixed Storage Systems
```typescript
// Wrong - don't mix storage types
if (useDatabase) {
  await supabaseClient.insert(data);
} else {
  await fileStorage.save(data);
}
```

### ❌ Inconsistent Error Handling
```typescript
// Wrong - inconsistent error handling
try {
  await saveData();
  alert('Saved!'); // Don't use alerts
} catch (err) {
  console.log(err); // Don't just log errors
}
```

## Best Practices

### ✅ Consistent Data Access
```typescript
// Correct - use the data provider pattern
const dataAPI = fileDataProvider.getAPI();
if (!dataAPI) {
  setError('Data storage is not available');
  return;
}
```

### ✅ Proper Error Handling
```typescript
// Correct - comprehensive error handling
try {
  const result = await dataAPI.saveCase(caseData);
  toast.success('Case saved successfully');
  return result;
} catch (err) {
  console.error('Failed to save case:', err);
  const errorMsg = 'Failed to save case. Please try again.';
  setError(errorMsg);
  toast.error(errorMsg);
  throw err;
}
```

### ✅ Efficient State Management
```typescript
// Correct - memoized selectors and callbacks
const selectedCase = useMemo(() => 
  cases.find(c => c.id === selectedCaseId), 
  [cases, selectedCaseId]
);

const handleSaveCase = useCallback(async (caseData) => {
  // Implementation
}, [dependencies]);
```

### ✅ Toast Notifications
```typescript
// Correct - consistent toast usage
const toastId = toast.loading("Saving case...");
try {
  await saveCase();
  toast.success("Case saved successfully", { id: toastId });
} catch (err) {
  toast.error("Failed to save case", { id: toastId });
}
```

## Styling Guidelines

### Tailwind CSS v4
- Use Tailwind utility classes for styling
- Follow the design system defined in `/styles/globals.css`
- Avoid font size, weight, and line-height classes (use defaults)
- Use color tokens from the CSS custom properties

### Typography
- Default typography is handled by global CSS
- Only override with Tailwind classes when specifically needed
- Maintain consistent spacing and hierarchy

### Responsive Design
- Desktop first approach
- Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`)
- Ensure touch-friendly interface elements
- Test on various screen sizes

## Security Considerations

### File System Access
- Always request proper permissions
- Handle permission denials gracefully
- Validate file contents before processing
- Sanitize user input before saving

### Data Validation
- Validate all imported data structures
- Sanitize user inputs
- Handle malformed data gracefully
- Preserve data integrity during operations

This architecture provides a robust, user-friendly case tracking platform that works entirely with local file storage, ensuring data privacy and offline capability.