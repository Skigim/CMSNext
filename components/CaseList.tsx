import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { CaseCard } from "./CaseCard";
import { CaseDisplay } from "../types/case";
import { setupSampleData } from "../utils/setupData";
import { Plus, Search, Database } from "lucide-react";

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
          <p className="text-muted-foreground">Manage and track all cases</p>
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search cases by name or MCN..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

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

      {filteredCases.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No cases found matching your search.</p>
        </div>
      )}


    </div>
  );
}