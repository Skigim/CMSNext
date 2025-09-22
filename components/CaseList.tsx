import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { CaseCard } from "./CaseCard";
import { VirtualCaseList } from "./VirtualCaseList";
import { CaseDisplay } from "../types/case";
import { setupSampleData } from "../utils/setupData";
import { Plus, Search, Database, List, Grid } from "lucide-react";
import { Toggle } from "./ui/toggle";

interface CaseListProps {
  cases: CaseDisplay[];
  onViewCase: (caseId: string) => void;
  onEditCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  onNewCase: () => void;
  onRefresh?: () => void;
}

export function CaseList({ cases, onViewCase, onEditCase, onDeleteCase, onNewCase, onRefresh }: CaseListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSettingUpData, setIsSettingUpData] = useState(false);
  const [useVirtualScrolling, setUseVirtualScrolling] = useState(false);

  // Automatically enable virtual scrolling for large datasets
  const shouldUseVirtual = cases.length > 100 || useVirtualScrolling;

  const handleSetupSampleData = async () => {
    try {
      setIsSettingUpData(true);
      await setupSampleData();
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to setup sample data:', error);
    } finally {
      setIsSettingUpData(false);
    }
  };

  const filteredCases = cases.filter(caseData =>
    (caseData.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (caseData.mcn || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Case Management</h1>
          <p className="text-muted-foreground">
            Manage and track all cases
            {shouldUseVirtual && filteredCases.length > 100 && (
              <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                Virtual scrolling enabled for {filteredCases.length} cases
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {cases.length === 0 && (
            <Button 
              variant="outline" 
              onClick={handleSetupSampleData}
              disabled={isSettingUpData}
            >
              <Database className="w-4 h-4 mr-2" />
              {isSettingUpData ? 'Setting up...' : 'Add Sample Data'}
            </Button>
          )}

          <Button onClick={onNewCase}>
            <Plus className="w-4 h-4 mr-2" />
            New Case
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search cases by name or MCN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {cases.length > 50 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">View:</span>
            <Toggle 
              pressed={shouldUseVirtual} 
              onPressedChange={setUseVirtualScrolling}
              aria-label="Toggle virtual scrolling"
              size="sm"
            >
              {shouldUseVirtual ? (
                <List className="w-4 h-4" />
              ) : (
                <Grid className="w-4 h-4" />
              )}
            </Toggle>
            <span className="text-xs text-muted-foreground">
              {shouldUseVirtual ? 'List' : 'Grid'}
            </span>
          </div>
        )}
      </div>

      {shouldUseVirtual ? (
        <VirtualCaseList
          cases={filteredCases}
          onViewCase={onViewCase}
          onEditCase={onEditCase}
          onDeleteCase={onDeleteCase}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCases.map((caseData, index) => (
            <CaseCard
              key={caseData.id || `case-${index}`}
              case={caseData}
              onView={onViewCase}
              onEdit={onEditCase}
              onDelete={onDeleteCase}
            />
          ))}
        </div>
      )}

      {filteredCases.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No cases found matching your search.</p>
        </div>
      )}


    </div>
  );
}