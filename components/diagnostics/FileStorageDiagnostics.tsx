import { useFileStorage } from '@/contexts/FileStorageContext';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { CaseDisplay } from '@/types/case';

export function FileStorageDiagnostics() {
  const context = useFileStorage();
  const [testFiles, setTestFiles] = useState<string[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  
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

  const migratePhase3Data = async () => {
    if (!context.service || !context.readNamedFile) {
      toast.error('File storage not available');
      return;
    }

    setIsMigrating(true);
    const toastId = toast.loading('Migrating Phase 3 data to legacy format...');

    try {
      // Read the current case-data.json
      const rawData = await context.readNamedFile('case-data.json');
      
      if (!rawData || !rawData.cases) {
        toast.error('No case data found to migrate', { id: toastId });
        return;
      }

      const cases = rawData.cases;
      const migratedCases: CaseDisplay[] = [];
      let migrationCount = 0;

      // Process each case
      for (const caseData of cases) {
        // Check if this is Phase 3 format (has metadata.legacyCase)
        if (caseData.metadata?.legacyCase?.caseDisplay) {
          // Extract the legacy CaseDisplay from metadata
          const legacyCase = caseData.metadata.legacyCase.caseDisplay;
          migratedCases.push(legacyCase);
          migrationCount++;
        } else {
          // Already in legacy format, keep as-is
          migratedCases.push(caseData);
        }
      }

      if (migrationCount === 0) {
        toast.info('No Phase 3 data found - already in legacy format', { id: toastId });
        setIsMigrating(false);
        return;
      }

      // Create backup first
      const backupName = `case-data-backup-${Date.now()}.json`;
      await context.service.writeNamedFile(backupName, rawData);

      // Write migrated data
      const migratedData = {
        ...rawData,
        cases: migratedCases,
        exported_at: new Date().toISOString(),
        total_cases: migratedCases.length,
      };

      await context.service.writeNamedFile('case-data.json', migratedData);

      toast.success(
        `Migrated ${migrationCount} case(s) to legacy format. Backup saved as ${backupName}`,
        { id: toastId, duration: 5000 }
      );

      // Suggest page reload
      setTimeout(() => {
        if (confirm('Migration complete! Reload the page to see changes?')) {
          window.location.reload();
        }
      }, 1000);

    } catch (error) {
      console.error('Migration error:', error);
      toast.error(
        `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { id: toastId }
      );
    } finally {
      setIsMigrating(false);
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

          <Button 
            variant="destructive"
            size="sm"
            onClick={migratePhase3Data}
            disabled={isMigrating || !context.service}
            aria-label="Migrate Phase 3 data format to legacy format"
          >
            {isMigrating ? 'Migrating...' : 'Migrate Phase 3 Data'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}