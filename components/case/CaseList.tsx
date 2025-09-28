import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { CaseCard } from "./CaseCard";
import { VirtualCaseList } from "../app/VirtualCaseList";
import { CaseDisplay } from "../../types/case";
import { setupSampleData } from "../../utils/setupData";
import {
  Plus,
  Search,
  Database,
  Grid,
  Table,
  Filter,
  SortAsc,
  RefreshCcw,
} from "lucide-react";
import { Toggle } from "../ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
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
import { CaseTable } from "./CaseTable";
import {
  useCaseListPreferences,
  type CaseListSegment,
  type CaseListSortKey,
} from "@/hooks/useCaseListPreferences";

interface CaseListProps {
  cases: CaseDisplay[];
  onViewCase: (caseId: string) => void;
  onEditCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  onNewCase: () => void;
  onRefresh?: () => void;
}

export function CaseList({ cases, onViewCase, onEditCase, onDeleteCase, onNewCase, onRefresh }: CaseListProps) {
  const { viewMode, setViewMode, sortKey, setSortKey, segment, setSegment } = useCaseListPreferences();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSettingUpData, setIsSettingUpData] = useState(false);
  const [useVirtualScrolling, setUseVirtualScrolling] = useState(false);
  const [showSampleDataDialog, setShowSampleDataDialog] = useState(false);

  const shouldUseVirtual = viewMode === "grid" && (cases.length > 100 || useVirtualScrolling);

  const handleSetupSampleData = useCallback(async () => {
    const toastId = toast.loading("Adding sample data...");
    try {
      setIsSettingUpData(true);
      await setupSampleData();
      toast.success("Sample data added", { id: toastId });
      onRefresh?.();
    } catch (error) {
      console.error("Failed to setup sample data:", error);
      toast.error("Unable to add sample data", { id: toastId });
    } finally {
      setIsSettingUpData(false);
      setShowSampleDataDialog(false);
    }
  }, [onRefresh]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  const handleViewModeChange = useCallback((value: string) => {
    if (value === "grid" || value === "table") {
      setViewMode(value);
    }
  }, [setViewMode]);

  const handleSortChange = useCallback((value: string) => {
    if (value === "updated" || value === "name" || value === "mcn") {
      setSortKey(value as CaseListSortKey);
    }
  }, [setSortKey]);

  const handleSegmentChange = useCallback((value: string) => {
    if (value === "all" || value === "recent" || value === "priority") {
      setSegment(value as CaseListSegment);
    }
  }, [setSegment]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const now = Date.now();
    const recentThreshold = now - 1000 * 60 * 60 * 24 * 14; // 14 days

    return cases.filter(caseData => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        (caseData.name || "").toLowerCase().includes(normalizedSearch) ||
        (caseData.mcn || "").toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      if (segment === "priority") {
        return Boolean(caseData.priority);
      }

      if (segment === "recent") {
        const updatedAt = Date.parse(caseData.updatedAt || caseData.caseRecord?.updatedDate || "");
        return Number.isFinite(updatedAt) && updatedAt >= recentThreshold;
      }

      return true;
    });
  }, [cases, searchTerm, segment]);

  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => {
      switch (sortKey) {
        case "name": {
          return (a.name || "").localeCompare(b.name || "");
        }
        case "mcn": {
          return (a.mcn || "").localeCompare(b.mcn || "");
        }
        case "updated":
        default: {
          const aUpdated = Date.parse(a.updatedAt || a.caseRecord?.updatedDate || a.createdAt);
          const bUpdated = Date.parse(b.updatedAt || b.caseRecord?.updatedDate || b.createdAt);
          return bUpdated - aUpdated;
        }
      }
    });
  }, [filteredCases, sortKey]);

  const noMatches = sortedCases.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1>Case Management</h1>
          <p className="text-muted-foreground">
            Manage and track all cases in your workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Database className="mr-2 h-4 w-4" /> Demo tools
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Data helpers</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setShowSampleDataDialog(true);
                }}
                disabled={isSettingUpData}
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> Add sample data
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                Additional helpers coming soon
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={onNewCase}>
            <Plus className="mr-2 h-4 w-4" />
            New case
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search cases by name or MCN..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10"
            aria-label="Search cases"
          />
        </div>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={handleViewModeChange}
          variant="outline"
          size="sm"
          aria-label="Select case list view"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <Grid className="mr-2 h-4 w-4" /> Grid view
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <Table className="mr-2 h-4 w-4" /> Table view
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ToggleGroup
          type="single"
          value={segment}
          onValueChange={handleSegmentChange}
          variant="outline"
          size="sm"
          aria-label="Filter case segments"
        >
          <ToggleGroupItem value="all" aria-label="All cases">
            <Filter className="mr-2 h-4 w-4" /> All cases
          </ToggleGroupItem>
          <ToggleGroupItem value="recent" aria-label="Recently updated">
            <Filter className="mr-2 h-4 w-4" /> Recently updated
          </ToggleGroupItem>
          <ToggleGroupItem value="priority" aria-label="Priority cases">
            <Filter className="mr-2 h-4 w-4" /> Priority
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup
          type="single"
          value={sortKey}
          onValueChange={handleSortChange}
          variant="outline"
          size="sm"
          aria-label="Sort cases"
        >
          <ToggleGroupItem value="updated" aria-label="Sort by last updated">
            <SortAsc className="mr-2 h-4 w-4" /> Updated
          </ToggleGroupItem>
          <ToggleGroupItem value="name" aria-label="Sort by name">
            <SortAsc className="mr-2 h-4 w-4" /> Name
          </ToggleGroupItem>
          <ToggleGroupItem value="mcn" aria-label="Sort by MCN">
            <SortAsc className="mr-2 h-4 w-4" /> MCN
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {viewMode === "table" ? (
        <CaseTable
          cases={sortedCases}
          onViewCase={onViewCase}
          onEditCase={onEditCase}
          onDeleteCase={onDeleteCase}
        />
      ) : shouldUseVirtual ? (
        <VirtualCaseList
          cases={sortedCases}
          onViewCase={onViewCase}
          onEditCase={onEditCase}
          onDeleteCase={onDeleteCase}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sortedCases.map(caseData => (
            <CaseCard
              key={caseData.id}
              case={caseData}
              onView={onViewCase}
              onEdit={onEditCase}
              onDelete={onDeleteCase}
            />
          ))}
        </div>
      )}

      {viewMode === "grid" && cases.length > 100 && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <Toggle
            pressed={useVirtualScrolling}
            onPressedChange={setUseVirtualScrolling}
            aria-label="Toggle virtual scrolling"
            size="sm"
          >
            {useVirtualScrolling ? "Virtual on" : "Virtual off"}
          </Toggle>
          <span>Virtual scrolling improves performance for large lists.</span>
        </div>
      )}

      {noMatches && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No cases match the current filters.</p>
        </div>
      )}

      <AlertDialog open={showSampleDataDialog} onOpenChange={setShowSampleDataDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add sample data?</AlertDialogTitle>
            <AlertDialogDescription>
              We'll add curated demo cases to your current workspace. Existing data will remain untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSettingUpData}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSetupSampleData} disabled={isSettingUpData}>
              {isSettingUpData ? "Adding..." : "Add sample data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CaseList;