import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ImportModal } from "../modals/ImportModal";

import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import FileStorageSettings from "../diagnostics/FileStorageSettings";
import { FileStorageDiagnostics } from "../diagnostics/FileStorageDiagnostics";
import { ErrorBoundaryTest } from "../error/ErrorBoundaryTest";
import { ErrorReportViewer } from "../error/ErrorReportViewer";
import { FeedbackPanel } from "../error/ErrorFeedbackForm";
import { CategoryConfigDevPanel } from "../diagnostics/CategoryConfigDevPanel";
import { CategoryManagerPanel } from "../category/CategoryManagerPanel";
import { AlertsPreviewPanel } from "../alerts/AlertsPreviewPanel";
import { useFileStorage } from "../../contexts/FileStorageContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  Upload,
  Download,
  Database,
  Palette,
  Trash2,
  Bug,
  FolderOpen,
  Check,
  Info,
  Code,
  ListChecks,
  FileSpreadsheet,
} from "lucide-react";
import { StoredCase } from "../../types/case";
import type { AlertsIndex } from "../../utils/alertsData";
import { toast } from "sonner";
import { useDataManagerSafe } from "../../contexts/DataManagerContext";
import { useCategoryConfig } from "../../contexts/CategoryConfigContext";
import type { CaseActivityLogState } from "../../types/activityLog";
import { useAppViewState } from "@/hooks/useAppViewState";

interface SettingsProps {
  cases: StoredCase[];
  activityLogState?: CaseActivityLogState;
  onDataPurged?: () => void;
  onAlertsCsvImported?: (index: AlertsIndex) => void;
}

export function Settings({ cases, onDataPurged, onAlertsCsvImported }: SettingsProps) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isAlertsImporting, setIsAlertsImporting] = useState(false);
  const alertsFileInputRef = useRef<HTMLInputElement>(null);
  const { disconnect } = useFileStorage();
  const { theme, setTheme, themeOptions } = useTheme();
  const dataManager = useDataManagerSafe();
  const { config } = useCategoryConfig();
  const { featureFlags } = useAppViewState();
  
  const showDevTools = featureFlags["settings.devTools"] ?? false;

  // Helper function to safely count valid cases
  const getValidCasesCount = () => {
    return cases.filter(c => c && c.caseRecord && typeof c.caseRecord === 'object').length;
  };

  const activeStatuses = useMemo(() => {
    const statuses = config.caseStatuses;
    if (!statuses.length) {
      return [] as StoredCase['status'][];
    }

    // Filter out denied/closed/inactive statuses by name
    const filtered = statuses.filter(status => !/denied|closed|inactive/i.test(status.name));
    const resultStatuses = filtered.length > 0 ? filtered : [statuses[0]];
    return resultStatuses.map(s => s.name) as StoredCase['status'][];
  }, [config.caseStatuses]);

  const getActiveCasesCount = () => {
    if (!activeStatuses.length) {
      return 0;
    }

    return cases.filter(
      c => c && c.caseRecord && activeStatuses.includes(c.caseRecord.status),
    ).length;
  };

  const getInvalidCasesCount = () => {
    return cases.filter(c => !c || !c.caseRecord || typeof c.caseRecord !== 'object').length;
  };

  const handleExportData = () => {
    try {
      const dataToExport = {
        exported_at: new Date().toISOString(),
        total_cases: cases.length,
        cases: cases
      };

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `case-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Successfully exported ${cases.length} cases to JSON file`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data. Please try again.');
    }
  };

  const handleAlertsCsvButtonClick = () => {
    if (!dataManager) {
      toast.error("Connect a storage folder before importing alerts.");
      return;
    }

    alertsFileInputRef.current?.click();
  };

  const handleAlertsCsvSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!dataManager) {
      toast.error("Alerts service isn't available yet. Connect storage and try again.");
      input.value = "";
      return;
    }

    setIsAlertsImporting(true);

    try {
      const csvText = await file.text();
      if (!csvText.trim()) {
        toast.info("No alerts detected", {
          description: `${file.name} is empty.`,
        });
        return;
      }

      const result = await dataManager.mergeAlertsFromCsvContent(csvText, {
        cases,
        sourceFileName: file.name,
      });

      const refreshedIndex = await dataManager.getAlertsIndex({ cases });
      onAlertsCsvImported?.(refreshedIndex);

      if (result.added === 0 && result.updated === 0) {
        toast.info("No new alerts found", {
          description: `${file.name} didn't include new or updated alerts. Still tracking ${result.total} alerts.`,
        });
      } else {
        const descriptionParts = [
          result.added > 0 ? `${result.added} new` : null,
          result.updated > 0 ? `${result.updated} updated` : null,
        ].filter(Boolean) as string[];

        toast.success("Alerts updated", {
          description: `${descriptionParts.join(" · ")} • ${result.total} total alerts saved`,
        });
      }
    } catch (error) {
      console.error("Failed to import alerts from CSV:", error);
      toast.error("Failed to import alerts", {
        description: error instanceof Error ? error.message : "Please verify the file and try again.",
      });
    } finally {
      setIsAlertsImporting(false);
      input.value = "";
    }
  };

  const handlePurgeDatabase = async () => {
    if (!confirm('Are you sure you want to delete ALL data? This action cannot be undone.')) {
      return;
    }

    if (!confirm('This will permanently delete all cases, people, and financial data. Are you absolutely sure?')) {
      return;
    }

    setIsPurging(true);
    try {
      // Use DataManager to purge data
      if (dataManager) {
        await dataManager.clearAllData();
      } else {
        console.warn('DataManager not available for purge operation');
      }
      
      // Also disconnect from the file storage to clear the directoryHandle
      try {
        await disconnect();
        console.log('File storage disconnected');
      } catch (err) {
        console.warn('Could not disconnect from file storage:', err);
      }
      
      // Notify parent component to refresh data
      if (onDataPurged) {
        onDataPurged();
      }
      
      toast.success('All data purged successfully!');
    } catch (error) {
      console.error('Error purging data:', error);
      toast.error('Failed to purge local storage. Please try again.');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage your case tracking system preferences and configuration.
        </p>
      </div>

      <Tabs defaultValue="data" className="space-y-6">
        <TabsList className={`grid w-full ${showDevTools ? 'grid-cols-6' : 'grid-cols-5'}`}>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Storage</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Categories</span>
          </TabsTrigger>
          {showDevTools && (
            <TabsTrigger value="development" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">Dev</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            <span className="hidden sm:inline">System</span>
          </TabsTrigger>
        </TabsList>

        {/* Data Management Tab */}
        <TabsContent value="data" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle>Data Management</CardTitle>
                </div>
                <CardDescription>
                  Import historical records, back up your workspace, or reset everything locally.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Import Section */}
                <section className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-medium">Import cases from JSON</h4>
                      <p className="text-sm text-muted-foreground">
                        Merge legacy exports or bulk records into your current workspace.
                      </p>
                    </div>
                    <Button
                      onClick={() => setIsImportModalOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Import JSON
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The importer validates structure and skips duplicates automatically.
                  </p>
                </section>

                <Separator />

                {/* Alerts CSV Section */}
                <section className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-medium">Update alerts from CSV</h4>
                      <p className="text-sm text-muted-foreground">
                        Merge new alert records into the alerts.json snapshot without losing workflow history.
                      </p>
                    </div>
                    <Button
                      onClick={handleAlertsCsvButtonClick}
                      className="flex items-center gap-2"
                      disabled={isAlertsImporting || !dataManager}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      {isAlertsImporting ? "Importing..." : "Import Alerts CSV"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We skip duplicates automatically and keep existing resolutions intact. Supported formats: .csv exports from your alerts system.
                  </p>
                </section>

                <Separator />

                {/* Export Section */}
                <section className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-medium">Export current data</h4>
                      <p className="text-sm text-muted-foreground">
                        Download a JSON backup that mirrors the on-disk folder structure.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleExportData}
                      disabled={cases.length === 0}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export JSON
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary">{cases.length}</Badge>
                      <span>Total cases</span>
                    </div>
                    {cases.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">{getActiveCasesCount()}</Badge>
                        <span>Active cases</span>
                      </div>
                    )}
                  </div>
                </section>

                <Separator />

                {/* Purge Section */}
                <section className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-medium text-destructive">Purge all data</h4>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete every case, person, and financial record from local storage.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={handlePurgeDatabase}
                      disabled={isPurging}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isPurging ? "Purging..." : "Purge local storage"}
                    </Button>
                  </div>

                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <div className="flex items-center gap-2 font-medium">
                      <Trash2 className="h-4 w-4" />
                      This action can’t be undone.
                    </div>
                    <p className="mt-2 text-destructive/80">
                      All local files will be removed and you’ll need to reconnect to a folder afterwards.
                    </p>
                  </div>
                </section>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  <CardTitle>Theme Settings</CardTitle>
                </div>
                <CardDescription>
                  Configure your application settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Theme Settings */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <h4 className="font-medium">Theme</h4>
                      <p className="text-sm text-muted-foreground">
                        Choose a theme that's comfortable for your eyes
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {themeOptions.map((option) => (
                      <Button
                        key={option.id}
                        variant={theme === option.id ? "default" : "outline"}
                        onClick={() => setTheme(option.id)}
                        className="flex items-center justify-between p-4 h-auto"
                      >
                        <div className="text-left">
                          <div className="font-medium text-sm">{option.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {option.description}
                          </div>
                        </div>
                        {theme === option.id && (
                          <Check className="h-4 w-4 ml-2" />
                        )}
                      </Button>
                    ))}
                  </div>
                  
                  <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>• <strong>Light:</strong> Clean, bright interface</div>
                      <div>• <strong>Dark:</strong> High contrast for low-light environments</div>
                      <div>• <strong>Soft Dark:</strong> Gentler dark theme, easier on the eyes</div>
                      <div>• <strong>Warm:</strong> Cream and beige tones for comfort</div>
                      <div>• <strong>Blue:</strong> Professional blue color scheme</div>
                      <div>• <strong>Paper:</strong> Sepia tones for a paper-like feel</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* File Storage Tab */}
        <TabsContent value="storage" className="space-y-6">
          <div className="grid gap-6">
            <FileStorageSettings />
            <FileStorageDiagnostics />
            
            {/* Storage Mode Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Storage Information
                </CardTitle>
                <CardDescription>
                  Current data storage configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Storage Mode</h4>
                      <p className="text-sm text-muted-foreground">
                        Current data storage configuration
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        File Storage
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        Local File Storage Active
                      </span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• Data is stored in local files using File System Access API</li>
                      <li>• Device-specific storage with auto-backup</li>
                      <li>• Works offline with local file access</li>
                      <li>• No data sent to external servers</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-6">
          <div className="grid gap-6">
            <CategoryManagerPanel
              description="Adjust the lists that appear in forms, dashboards, and reports. Updates apply immediately across the workspace."
              supportingContent={(
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Add, rename, or remove options to match the language your organization uses. Changes save to the connected data folder so teammates pick them up automatically.
                  </p>
                  <p className="text-xs text-muted-foreground/80">
                    Tip: keep the most frequently used options near the top for quicker selections in forms.
                  </p>
                </div>
              )}
            />
          </div>
        </TabsContent>

        {/* Development Tab - Only shown when devTools feature flag is enabled */}
        {showDevTools && (
          <TabsContent value="development" className="space-y-6">
            <div className="grid gap-6">
              <AlertsPreviewPanel cases={cases} />
              <CategoryConfigDevPanel />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bug className="h-5 w-5" />
                    Error Testing & Debugging
                  </CardTitle>
                  <CardDescription>
                    Tools for testing error handling and debugging
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ErrorBoundaryTest />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Reports</CardTitle>
                  <CardDescription>
                    View and manage error reports from the application
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ErrorReportViewer />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>User Feedback</CardTitle>
                  <CardDescription>
                    Submit feedback about the application
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FeedbackPanel />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* System Information Tab */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>
                  Information about your case tracking system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-foreground">Total Cases</div>
                    <div className="text-muted-foreground">{cases.length}</div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Active Cases</div>
                    <div className="text-muted-foreground">
                      {getActiveCasesCount()}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Last Updated</div>
                    <div className="text-muted-foreground">
                      {cases.length > 0 ? new Date().toLocaleDateString() : 'No data'}
                    </div>
                  </div>
                </div>
                
                {/* Data Integrity Information */}
                {getInvalidCasesCount() > 0 && (
                  <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Bug className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        Data Integrity Issues Detected
                      </span>
                    </div>
                    <div className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                      <div>• {getInvalidCasesCount()} cases have malformed or missing caseRecord data</div>
                      <div>• {getValidCasesCount()} cases are properly formatted</div>
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            console.log('🔍 Data Integrity Analysis:');
                            console.log(`Total cases: ${cases.length}`);
                            console.log(`Valid cases: ${getValidCasesCount()}`);
                            console.log(`Invalid cases: ${getInvalidCasesCount()}`);
                            
                            // Log invalid cases for debugging
                            const invalidCases = cases.filter(c => !c || !c.caseRecord || typeof c.caseRecord !== 'object');
                            console.log('Invalid cases:', invalidCases);
                          }}
                          className="text-xs h-7 text-orange-700 dark:text-orange-300 border-orange-300"
                        >
                          Log Invalid Cases
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <input
        ref={alertsFileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleAlertsCsvSelected}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}

export default Settings;