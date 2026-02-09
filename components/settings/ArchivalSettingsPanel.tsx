/**
 * @fileoverview Archival Settings Panel
 * 
 * Configuration UI for the case archival system.
 * Allows users to:
 * - Configure archival threshold (months)
 * - Toggle "closed cases only" setting
 * - Manually refresh the archival queue
 * - Browse and restore from archive files
 * 
 * @module components/settings/ArchivalSettingsPanel
 */

import { useCallback, useEffect, useState, useMemo } from "react";
import { Archive, RefreshCw, FolderOpen, RotateCcw, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useDataManagerSafe } from "@/contexts/DataManagerContext";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { useCaseArchival, useFuzzySearch } from "@/hooks";
import type { ArchiveFileInfo } from "@/utils/services/CaseArchiveService";
import type { CaseArchiveData, ArchivalSettings } from "@/types/archive";
import { DEFAULT_ARCHIVAL_SETTINGS } from "@/types/archive";

/**
 * ArchivalSettingsPanel - Configure and manage case archival
 */
export function ArchivalSettingsPanel() {
  const dataManager = useDataManagerSafe();
  const { config, refresh: refreshConfig } = useCategoryConfig();
  const isMountedRef = { current: true };
  
  // Local state for settings form
  const [thresholdMonths, setThresholdMonths] = useState(
    config.archivalSettings?.thresholdMonths ?? DEFAULT_ARCHIVAL_SETTINGS.thresholdMonths
  );
  const [archiveClosedOnly, setArchiveClosedOnly] = useState(
    config.archivalSettings?.archiveClosedOnly ?? DEFAULT_ARCHIVAL_SETTINGS.archiveClosedOnly
  );
  const [isSaving, setIsSaving] = useState(false);
  
  // Archive browsing state
  const [selectedArchive, setSelectedArchive] = useState<CaseArchiveData | null>(null);
  const [selectedArchiveFileName, setSelectedArchiveFileName] = useState<string | null>(null);
  const [selectedCasesToRestore, setSelectedCasesToRestore] = useState<Set<string>>(new Set());
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  
  // Fuzzy search for archive cases
  const { query: searchQuery, setQuery: setSearchQuery, results: searchResults, clearSearch } = useFuzzySearch({
    cases: selectedArchive?.cases ?? [],
    alerts: [],
    options: { maxResults: 100, minChars: 1 },
  });
  
  // Use archival hook
  const archival = useCaseArchival({
    dataManager,
    isMounted: isMountedRef,
  });
  
  // Sync settings from config
  useEffect(() => {
    setThresholdMonths(
      config.archivalSettings?.thresholdMonths ?? DEFAULT_ARCHIVAL_SETTINGS.thresholdMonths
    );
    setArchiveClosedOnly(
      config.archivalSettings?.archiveClosedOnly ?? DEFAULT_ARCHIVAL_SETTINGS.archiveClosedOnly
    );
  }, [config.archivalSettings]);
  
  // Load archive files on mount
  useEffect(() => {
    archival.refreshArchiveList();
    archival.refreshPendingCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const hasUnsavedChanges = useMemo(() => {
    const currentThreshold = config.archivalSettings?.thresholdMonths ?? DEFAULT_ARCHIVAL_SETTINGS.thresholdMonths;
    const currentClosedOnly = config.archivalSettings?.archiveClosedOnly ?? DEFAULT_ARCHIVAL_SETTINGS.archiveClosedOnly;
    return thresholdMonths !== currentThreshold || archiveClosedOnly !== currentClosedOnly;
  }, [config.archivalSettings, thresholdMonths, archiveClosedOnly]);
  
  const handleSaveSettings = useCallback(async () => {
    if (!dataManager) {
      toast.error("Data manager not available");
      return;
    }
    
    setIsSaving(true);
    try {
      const newSettings: ArchivalSettings = {
        thresholdMonths,
        archiveClosedOnly,
      };
      
      // Update the full category config with new archival settings
      await dataManager.updateCategoryConfig({
        ...config,
        archivalSettings: newSettings,
      });
      
      // Refresh the context to pick up changes
      await refreshConfig();
      
      toast.success("Archival settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }, [dataManager, thresholdMonths, archiveClosedOnly, config, refreshConfig]);
  
  const handleRefreshQueue = useCallback(async () => {
    await archival.refreshQueue();
  }, [archival]);
  
  const handleLoadArchive = useCallback(async (fileName: string) => {
    const archive = await archival.loadArchive(fileName);
    if (archive) {
      setSelectedArchive(archive);
      setSelectedArchiveFileName(fileName);
      setSelectedCasesToRestore(new Set());
    }
  }, [archival]);
  
  const handleCloseArchive = useCallback(() => {
    setSelectedArchive(null);
    setSelectedArchiveFileName(null);
    setSelectedCasesToRestore(new Set());
    setStatusFilter("");
    clearSearch();
  }, [clearSearch]);
  
  const handleToggleCaseSelection = useCallback((caseId: string) => {
    setSelectedCasesToRestore(prev => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  }, []);
  
  const handleSelectAllCases = useCallback(() => {
    if (!selectedArchive) return;
    const allIds = new Set(selectedArchive.cases.map(c => c.id));
    setSelectedCasesToRestore(allIds);
  }, [selectedArchive]);
  
  const handleDeselectAllCases = useCallback(() => {
    setSelectedCasesToRestore(new Set());
  }, []);
  
  const handleRestoreConfirm = useCallback(async () => {
    if (!selectedArchiveFileName || selectedCasesToRestore.size === 0) return;
    
    setShowRestoreDialog(false);
    const result = await archival.restoreCases(
      selectedArchiveFileName,
      Array.from(selectedCasesToRestore)
    );
    
    if (result && result.restoredCount > 0) {
      // Refresh the loaded archive
      const updated = await archival.loadArchive(selectedArchiveFileName);
      setSelectedArchive(updated);
      setSelectedCasesToRestore(new Set());
      setStatusFilter("");
      clearSearch();
    }
  }, [selectedArchiveFileName, selectedCasesToRestore, archival, clearSearch]);
  
  // Get unique statuses from archive for filter dropdown
  const archiveStatuses = useMemo(() => {
    if (!selectedArchive) return [];
    return Array.from(new Set(selectedArchive.cases.map(c => c.status))).sort();
  }, [selectedArchive]);
  
  // Compute filtered cases based on search and status filter
  const filteredCases = useMemo(() => {
    if (!selectedArchive) return [];
    
    const searchMatchIds = new Set(searchResults.cases.map(r => r.item.id));
    
    let cases = selectedArchive.cases;
    
    // Apply search filter if query exists
    if (searchQuery.trim().length > 0) {
      cases = cases.filter(c => searchMatchIds.has(c.id));
    }
    
    // Apply status filter if selected
    if (statusFilter) {
      cases = cases.filter(c => c.status === statusFilter);
    }
    
    return cases;
  }, [selectedArchive, searchResults, searchQuery, statusFilter]);
  
  if (!dataManager) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Case Archival
          </CardTitle>
          <CardDescription>
            Connect to a data folder to configure archival settings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Archival Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Archival Settings
          </CardTitle>
          <CardDescription>
            Configure when cases become eligible for archival review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="threshold-months">Inactivity Threshold (Months)</Label>
              <Input
                id="threshold-months"
                type="number"
                min={1}
                max={120}
                value={thresholdMonths}
                onChange={(e) => setThresholdMonths(parseInt(e.target.value) || 12)}
              />
              <p className="text-xs text-muted-foreground">
                Cases inactive for this many months will appear in the archival review queue.
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="closed-only"
                  checked={archiveClosedOnly}
                  onCheckedChange={setArchiveClosedOnly}
                />
                <Label htmlFor="closed-only">Archive Closed Cases Only</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                When enabled, only cases with "Closed" or "Archived" status can be archived.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSaveSettings}
              disabled={!hasUnsavedChanges || isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
            
            <Separator orientation="vertical" className="h-8" />
            
            <Button
              variant="outline"
              onClick={handleRefreshQueue}
              disabled={archival.isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${archival.isLoading ? 'animate-spin' : ''}`} />
              Refresh Queue
            </Button>
            
            {archival.pendingCount > 0 && (
              <Badge variant="secondary">
                {archival.pendingCount} pending review
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Archive Browser Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Archive Browser
          </CardTitle>
          <CardDescription>
            Browse and restore cases from archive files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {archival.archiveFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No archive files found. Cases will be archived to separate files when you approve them from the archival review queue.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {archival.archiveFiles.map((file: ArchiveFileInfo) => (
                  <Button
                    key={file.fileName}
                    variant={selectedArchiveFileName === file.fileName ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleLoadArchive(file.fileName)}
                    disabled={archival.isLoading}
                  >
                    <Archive className="mr-1.5 h-3.5 w-3.5" />
                    {file.year}
                  </Button>
                ))}
              </div>
              
              {selectedArchive && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">
                        {selectedArchiveFileName}
                      </h4>
                      <Badge variant="secondary">
                        {selectedArchive.cases.length} cases
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {new Date(selectedArchive.archivedAt).toLocaleDateString()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedCasesToRestore.size > 0 && (
                        <Button
                          size="sm"
                          onClick={() => setShowRestoreDialog(true)}
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          Restore {selectedCasesToRestore.size}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCloseArchive}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="archive-search" className="text-sm">
                          Search Cases
                        </Label>
                        <div className="relative">
                          <Input
                            id="archive-search"
                            placeholder="Search by name, MCN, or description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pr-8"
                          />
                          {searchQuery && (
                            <button
                              onClick={clearSearch}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="archive-status-filter" className="text-sm">
                          Filter by Status
                        </Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger id="archive-status-filter">
                            <SelectValue placeholder="All statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All statuses</SelectItem>
                            {archiveStatuses.map(status => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={handleSelectAllCases}
                      >
                        Select All
                      </Button>
                      <span className="text-muted-foreground">|</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={handleDeselectAllCases}
                      >
                        Deselect All
                      </Button>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {filteredCases.length} of {selectedArchive.cases.length} cases
                      </span>
                    </div>
                  </div>
                  
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>MCN</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCases.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-sm text-muted-foreground">
                              {selectedArchive.cases.length === 0 ? "No cases in archive" : "No cases match your search"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCases.map(caseItem => (
                            <TableRow
                              key={caseItem.id}
                              className="cursor-pointer"
                              onClick={() => handleToggleCaseSelection(caseItem.id)}
                            >
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={selectedCasesToRestore.has(caseItem.id)}
                                  onChange={() => handleToggleCaseSelection(caseItem.id)}
                                  className="h-4 w-4"
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {caseItem.name || `${caseItem.person?.firstName} ${caseItem.person?.lastName}`}
                              </TableCell>
                              <TableCell>{caseItem.mcn || caseItem.caseRecord?.mcn || "—"}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{caseItem.status}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {new Date(caseItem.updatedAt).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restore {selectedCasesToRestore.size} case{selectedCasesToRestore.size === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the selected cases along with their notes and financial items back to your active case list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restore Cases
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

