import { useFileStorage } from '@/contexts/FileStorageContext';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function FileStorageDiagnostics() {
  const context = useFileStorage();
  const [testFiles, setTestFiles] = useState<string[]>([]);
  
  console.log('[FileStorageDiagnostics] Full context:', context);
  
  const testListFiles = async () => {
    try {
      console.log('Testing listDataFiles...');
      const files = await context.listDataFiles();
      console.log('Test result:', files);
      setTestFiles(files);
    } catch (error) {
      console.error('Test error:', error);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>FileStorage Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Storage Connection Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Service Status</span>
            <Badge 
              variant={context.service ? 'default' : 'destructive'}
              role="status"
              aria-label={`Service ${context.service ? 'available' : 'missing'}`}
            >
              {context.service ? '✓ Available' : '✗ Missing'}
            </Badge>
          </div>
        </div>

        {/* Capabilities */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Capabilities</h4>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span>isSupported</span>
              <Badge 
                variant={context.isSupported ? 'secondary' : 'destructive'}
                role="status"
                aria-label={`File storage supported: ${context.isSupported}`}
              >
                {String(context.isSupported)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>isConnected</span>
              <Badge 
                variant={context.isConnected ? 'secondary' : 'outline'}
                role="status"
                aria-label={`File storage connected: ${context.isConnected}`}
              >
                {String(context.isConnected)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>hasStoredHandle</span>
              <Badge 
                variant={context.hasStoredHandle ? 'secondary' : 'outline'}
                role="status"
                aria-label={`Stored handle available: ${context.hasStoredHandle}`}
              >
                {String(context.hasStoredHandle)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Status Details */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Status Details</h4>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
            {context.status ? JSON.stringify(context.status, null, 2) : 'null'}
          </pre>
        </div>

        {/* API Methods */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Available Methods</h4>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span>connectToFolder</span>
              <Badge variant="outline">{typeof context.connectToFolder}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>listDataFiles</span>
              <Badge variant="outline">{typeof context.listDataFiles}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>readNamedFile</span>
              <Badge variant="outline">{typeof context.readNamedFile}</Badge>
            </div>
          </div>
        </div>

        {/* Test Results */}
        {testFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Test Files</h4>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(testFiles, null, 2)}
            </pre>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button 
            variant="default"
            size="sm"
            onClick={() => console.log('Current context:', context)}
            aria-label="Log current storage context to browser console"
          >
            Log Context to Console
          </Button>
          
          <Button 
            variant="secondary"
            size="sm"
            onClick={testListFiles}
            aria-label="Test file listing capability"
          >
            Test List Files
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}