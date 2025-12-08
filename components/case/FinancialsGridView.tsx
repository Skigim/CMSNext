import { CaseSection } from "./CaseSection";
import { Button } from "../ui/button";
import { FileUp } from "lucide-react";
import { useAVSImportFlow } from "../../hooks/useAVSImportFlow";
import { AVSImportModal } from "../modals/AVSImportModal";
import type { StoredCase } from "../../types/case";

interface FinancialsGridViewProps {
  caseId: string;
  selectedCase?: StoredCase | null;
}

/**
 * A 3-column grid layout showing all financial categories (Resources, Income, Expenses)
 * side by side. This is an alternative to the tabbed view in CaseDetails.
 */
export function FinancialsGridView({ caseId, selectedCase }: FinancialsGridViewProps) {
  const {
    importState,
    openImportModal,
    closeImportModal,
    handleInputChange,
    clearInput,
    importAccounts,
    toggleAccountSelection,
    toggleAllAccounts,
    canImport,
  } = useAVSImportFlow({ selectedCase: selectedCase ?? null });

  return (
    <div className="space-y-4">
      {/* Header with Import Button */}
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={openImportModal}
          className="gap-2"
        >
          <FileUp className="h-4 w-4" />
          Import AVS
        </Button>
      </div>

      {/* Financial Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <CaseSection title="Resources" category="resources" caseId={caseId} />
        <CaseSection title="Income" category="income" caseId={caseId} />
        <CaseSection title="Expenses" category="expenses" caseId={caseId} />
      </div>

      {/* AVS Import Modal */}
      <AVSImportModal
        importState={importState}
        onInputChange={handleInputChange}
        onClear={clearInput}
        onImport={importAccounts}
        onClose={closeImportModal}
        onToggleAccount={toggleAccountSelection}
        onToggleAll={toggleAllAccounts}
        canImport={canImport}
      />
    </div>
  );
}
