import { useFileStorage } from '../contexts/FileStorageContext';
import { useState } from 'react';

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
    <div className="p-4 border border-border rounded bg-card text-card-foreground">
      <h3 className="font-bold mb-2">FileStorage Diagnostics</h3>
      <div className="text-sm space-y-1">
        <div>Service: {context.service ? '✓ Available' : '✗ Missing'}</div>
        <div>isSupported: {String(context.isSupported)}</div>
        <div>isConnected: {String(context.isConnected)}</div>
        <div>hasStoredHandle: {String(context.hasStoredHandle)}</div>
        <div>Status: {context.status ? JSON.stringify(context.status, null, 2) : 'null'}</div>
        <div>connectToFolder: {typeof context.connectToFolder}</div>
        <div>listDataFiles: {typeof context.listDataFiles}</div>
        <div>readNamedFile: {typeof context.readNamedFile}</div>
        <div>Test files: {JSON.stringify(testFiles)}</div>
      </div>
      
      <div className="mt-2 space-x-2">
        <button 
          onClick={() => console.log('Current context:', context)}
          className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
        >
          Log Context to Console
        </button>
        
        <button 
          onClick={testListFiles}
          className="px-2 py-1 bg-emerald-600 dark:bg-emerald-700 text-white rounded text-xs hover:bg-emerald-700 dark:hover:bg-emerald-800"
        >
          Test List Files
        </button>
      </div>
    </div>
  );
}