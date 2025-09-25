import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFileStorage } from "@/contexts/FileStorageContext";
import { useDataManagerSafe } from "@/contexts/DataManagerContext";

export function FileServiceDiagnostic() {
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const { service, isConnected, status, hasStoredHandle } = useFileStorage();
  const dataManager = useDataManagerSafe();

  const runDiagnostic = async () => {
    const result: any = {
      timestamp: new Date().toISOString(),
      fileStorage: {
        hasService: !!service,
        isConnected,
        hasStoredHandle,
        status: status ? {
          status: status.status,
          message: status.message,
          permissionStatus: status.permissionStatus
        } : null
      },
      dataManager: {
        hasDataManager: !!dataManager
      }
    };

    if (service) {
      try {
        // Test basic service functionality
        result.serviceTests = {
          isSupported: service.isSupported(),
          hasDirectoryHandle: !!(service as any).directoryHandle,
          state: (service as any).state
        };

        // Test permission check
        try {
          const permission = await (service as any).checkPermission();
          result.serviceTests.permissionCheck = permission;
        } catch (err) {
          result.serviceTests.permissionCheckError = err instanceof Error ? err.message : 'Unknown error';
        }

        // Test file read
        if (dataManager) {
          try {
            const cases = await dataManager.getAllCases();
            result.dataTests = {
              success: true,
              caseCount: cases.length
            };
          } catch (err) {
            result.dataTests = {
              success: false,
              error: err instanceof Error ? err.message : 'Unknown error'
            };
          }
        }
      } catch (err) {
        result.serviceError = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    setDiagnosticResult(result);
    console.log('[FileServiceDiagnostic] Full diagnostic result:', result);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>File Service Diagnostic</CardTitle>
        <CardDescription>
          Debug file service connection and data loading issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button onClick={runDiagnostic}>
            Run Diagnostic
          </Button>
          
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            {hasStoredHandle && (
              <Badge variant="outline">
                Has Stored Handle
              </Badge>
            )}
          </div>
        </div>

        {diagnosticResult && (
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">File Storage Status</h4>
              <div className="text-sm space-y-1">
                <div>Service Available: {diagnosticResult.fileStorage.hasService ? '✅' : '❌'}</div>
                <div>Connected: {diagnosticResult.fileStorage.isConnected ? '✅' : '❌'}</div>
                <div>Has Stored Handle: {diagnosticResult.fileStorage.hasStoredHandle ? '✅' : '❌'}</div>
                {diagnosticResult.fileStorage.status && (
                  <div>Status: {diagnosticResult.fileStorage.status.status} - {diagnosticResult.fileStorage.status.message}</div>
                )}
              </div>
            </div>

            {diagnosticResult.serviceTests && (
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Service Tests</h4>
                <div className="text-sm space-y-1">
                  <div>API Supported: {diagnosticResult.serviceTests.isSupported ? '✅' : '❌'}</div>
                  <div>Directory Handle: {diagnosticResult.serviceTests.hasDirectoryHandle ? '✅' : '❌'}</div>
                  <div>Permission: {diagnosticResult.serviceTests.permissionCheck || 'Unknown'}</div>
                  {diagnosticResult.serviceTests.permissionCheckError && (
                    <div className="text-destructive">Permission Error: {diagnosticResult.serviceTests.permissionCheckError}</div>
                  )}
                </div>
              </div>
            )}

            {diagnosticResult.dataTests && (
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Data Loading Tests</h4>
                <div className="text-sm space-y-1">
                  {diagnosticResult.dataTests.success ? (
                    <div>✅ Successfully loaded {diagnosticResult.dataTests.caseCount} cases</div>
                  ) : (
                    <div className="text-destructive">❌ Failed to load data: {diagnosticResult.dataTests.error}</div>
                  )}
                </div>
              </div>
            )}

            <details className="text-xs">
              <summary className="cursor-pointer font-medium">Raw Diagnostic Data</summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                {JSON.stringify(diagnosticResult, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}