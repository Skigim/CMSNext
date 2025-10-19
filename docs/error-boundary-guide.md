# Error Boundary Implementation Guide

## Overview

This implementation provides comprehensive error handling for the CMSNext application using React Error Boundaries. The system includes both general error boundaries and specialized file system error boundaries to provide graceful error recovery.

## Components

### 1. ErrorBoundary (`components/ErrorBoundary.tsx`)

A general-purpose error boundary class component that catches all React render errors.

**Features:**
- Catches and displays render errors
- Provides retry functionality
- Shows development error details
- Supports custom fallback UI
- Automatic reset on prop changes
- Toast notifications for errors

**Usage:**
```tsx
import ErrorBoundary from './components/ErrorBoundary';

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

**Props:**
- `children`: ReactNode - Components to wrap
- `fallback?`: ReactNode - Custom fallback UI
- `onError?`: Function - Custom error handler
- `resetOnPropsChange?`: boolean - Auto-reset when props change
- `resetKeys?`: Array - Keys to watch for auto-reset

### 2. FileSystemErrorBoundary (`components/FileSystemErrorBoundary.tsx`)

Specialized error boundary for file system operations with enhanced error messages.

**Features:**
- Detects file system related errors
- Provides user-friendly error messages for common file system issues
- Specific handling for permission, security, and quota errors
- Compact and full-size display modes
- Retry functionality for file operations

**Usage:**
```tsx
import FileSystemErrorBoundary from './components/FileSystemErrorBoundary';

<FileSystemErrorBoundary>
  <FileSystemComponent />
</FileSystemErrorBoundary>
```

**Error Types Handled:**
- `AbortError` - User cancelled operation
- `NotAllowedError` - Permission denied
- `SecurityError` - Browser security restrictions
- `QuotaExceededError` - Storage quota exceeded
- Unsupported browser errors

### 3. ErrorFallback Components (`components/ErrorFallback.tsx`)

Reusable fallback UI components for consistent error display.

**Components:**
- `ErrorFallback` - General error fallback UI
- `FileSystemErrorFallback` - Specialized file system error UI

**Features:**
- Consistent styling with theme support
- Retry and reload buttons
- Development error details
- Compact and full-size modes

## Implementation Strategy

### Application Structure

```
main.tsx
├── ErrorBoundary (Top-level - catches all unhandled errors)
    └── App
        └── ThemeProvider
            └── FileSystemErrorBoundary (File system specific errors)
                └── FileStorageProvider
                    └── Application Content
```

### Error Boundary Hierarchy

1. **Top Level (`main.tsx`)**: `ErrorBoundary` catches any unhandled application errors
2. **File System Level (`App.tsx`)**: `FileSystemErrorBoundary` catches file system specific errors
3. **Component Level**: Additional error boundaries can be added around specific components

### Error Types and Handling

| Error Type | Boundary | Fallback UI | Recovery Options |
|------------|----------|-------------|------------------|
| General React Errors | ErrorBoundary | Full-screen error page | Retry, Reload |
| File System Errors | FileSystemErrorBoundary | Compact error card | Retry, Reload, Permissions |
| Async Errors | Not caught | Component-level handling | Manual error handling |

## Best Practices

### 1. Error Boundary Placement

```tsx
// ✅ Good - Wrap high-level components
<ErrorBoundary>
  <ExpensiveComponent />
</ErrorBoundary>

// ✅ Good - Wrap file system operations
<FileSystemErrorBoundary>
  <FileOperationComponent />
</FileSystemErrorBoundary>

// ❌ Avoid - Too granular
<ErrorBoundary>
  <Button>Click me</Button>
</ErrorBoundary>
```

### 2. Custom Error Handling

```tsx
<ErrorBoundary
  onError={(error, errorInfo) => {
    // Log to monitoring service
    console.error('Error caught:', error, errorInfo);
    
    // Custom analytics
    analytics.track('error_boundary_triggered', {
      error: error.message,
      component: errorInfo.componentStack
    });
  }}
>
  <YourComponent />
</ErrorBoundary>
```

### 3. Reset Keys for State Changes

```tsx
<ErrorBoundary
  resetOnPropsChange={true}
  resetKeys={[userId, selectedCase]}
>
  <UserCaseComponent userId={userId} caseId={selectedCase} />
</ErrorBoundary>
```

## Development and Testing

### Error Boundary Test Component

A development-only component (`ErrorBoundaryTest`) is available in the Settings page for testing error boundaries.

**Test Scenarios:**
1. **General Error**: Tests basic ErrorBoundary functionality
2. **File System Error**: Tests FileSystemErrorBoundary with permission errors
3. **Async Error**: Demonstrates what errors are NOT caught (for education)

### Manual Testing

1. Navigate to Settings page
2. Look for "Error Boundary Testing" section (development only)
3. Click test buttons to trigger different error types
4. Verify error boundaries show appropriate fallback UI
5. Test retry functionality

### Autosave Badge Reference

The autosave badge communicates storage health at a glance. Use this table as the canonical reference for releases, smoke checks, and troubleshooting:

| Lifecycle state | Badge label | Notes |
|-----------------|-------------|-------|
| `idle` / `ready` | **All changes saved** (or **Autosave ready** when no writes yet) | Indicates the service is connected and idle with no pending writes. |
| `saving` | **Saving…** | Spinner appears; badge may append “n pending writes.” Manual save button is disabled until completion. |
| `retrying` | **Retrying save…** | Shows current attempt copy (e.g., “Autosave retrying (attempt 2)…”). Spinner remains visible. |
| `permission-required` / `blocked` | **Permission required** | Warns that folder access is missing. Pending writes count remains visible so the user knows work still needs to flush. |
| `error` | **Save failed** | Destructive tone; pairs with toast copy describing the failing operation. |
| `unsupported` | **Not available** | Displayed when the browser lacks File System Access API support. |

During manual smoke checks you can capture the badge, toast stack, and console status (via `globalThis.__cmsAutosaveService.getStatus()`) for any anomalies, but screenshot archives are optional for solo development.

### Browser Console Testing

```javascript
// Trigger a general error (will be caught)
throw new Error('Test error');

// Trigger a file system error (will be caught by FileSystemErrorBoundary)
const error = new Error('Permission denied');
error.name = 'NotAllowedError';
throw error;
```

## Error Monitoring

### Production Considerations

1. **Error Logging**: Implement error reporting service integration
2. **User Feedback**: Collect user feedback when errors occur
3. **Graceful Degradation**: Ensure app remains functional after errors
4. **Recovery Paths**: Provide clear recovery options for users

### Error Tracking Integration

```tsx
<ErrorBoundary
  onError={(error, errorInfo) => {
    // Example integration with error tracking service
    if (process.env.NODE_ENV === 'production') {
      errorTrackingService.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      });
    }
  }}
>
  <App />
</ErrorBoundary>
```

## Limitations

### What Error Boundaries DON'T Catch

1. **Event handlers** - Use try/catch in event handlers
2. **Async code** - Use .catch() or try/catch in async functions
3. **Server-side rendering errors**
4. **Errors in the error boundary itself**

### Example: Async Error Handling

```tsx
// ❌ Not caught by error boundary
const handleAsyncOperation = async () => {
  const result = await riskyAsyncOperation(); // Error here won't be caught
};

// ✅ Proper async error handling
const handleAsyncOperation = async () => {
  try {
    const result = await riskyAsyncOperation();
  } catch (error) {
    console.error('Async operation failed:', error);
    toast.error('Operation failed. Please try again.');
  }
};
```

## Future Enhancements

1. **Error Reporting Integration**: Add Sentry or similar service
2. **User Feedback Collection**: Allow users to report bugs from error screens
3. **Offline Error Handling**: Special handling for network-related errors
4. **Component-Specific Boundaries**: Add boundaries around complex components
5. **Error Analytics**: Track error patterns and frequencies

## Conclusion

This error boundary implementation provides a robust safety net for the CMSNext application, ensuring users never see a white screen of death. The system gracefully handles both general React errors and file system specific issues, providing clear recovery paths and maintaining application stability.