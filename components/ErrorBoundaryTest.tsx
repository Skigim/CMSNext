// This component is for development testing of error boundaries
// Remove or comment out in production builds

import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

export function ErrorBoundaryTest() {
  const [shouldThrowError, setShouldThrowError] = useState(false);
  const [shouldThrowFileSystemError, setShouldThrowFileSystemError] = useState(false);

  // This will trigger a React render error that should be caught by ErrorBoundary
  if (shouldThrowError) {
    throw new Error('Test error for ErrorBoundary - this is intentional for testing');
  }

  // This will trigger a file system related error
  if (shouldThrowFileSystemError) {
    const error = new Error('File system access denied - test error');
    error.name = 'NotAllowedError';
    throw error;
  }

  const triggerAsyncError = async () => {
    try {
      // Simulate a file system error
      const error = new Error('Async file system error');
      error.name = 'SecurityError';
      throw error;
    } catch (err) {
      console.error('Async error:', err);
      // Note: Async errors won't be caught by error boundaries
      // They need to be handled in the component
    }
  };

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-lg">Error Boundary Testing</CardTitle>
        <CardDescription>
          Test error boundary functionality (Development only)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            These buttons will trigger errors to test error boundary functionality.
            The page should show error fallback UI instead of crashing.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Button
            onClick={() => setShouldThrowError(true)}
            variant="destructive"
            size="sm"
            className="w-full"
          >
            Trigger General Error
          </Button>
          
          <Button
            onClick={() => setShouldThrowFileSystemError(true)}
            variant="destructive"
            size="sm"
            className="w-full"
          >
            Trigger File System Error
          </Button>
          
          <Button
            onClick={triggerAsyncError}
            variant="outline"
            size="sm"
            className="w-full"
          >
            Trigger Async Error (Won't be caught)
          </Button>
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            Note: Async errors (like network requests) are not caught by error boundaries.
            Only synchronous render errors are caught.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export default ErrorBoundaryTest;