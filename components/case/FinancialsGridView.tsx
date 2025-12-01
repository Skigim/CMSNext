import { CaseSection } from "./CaseSection";

interface FinancialsGridViewProps {
  caseId: string;
}

/**
 * A 3-column grid layout showing all financial categories (Resources, Income, Expenses)
 * side by side. This is an alternative to the tabbed view in CaseDetails.
 */
export function FinancialsGridView({ caseId }: FinancialsGridViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <CaseSection title="Resources" category="resources" caseId={caseId} />
      <CaseSection title="Income" category="income" caseId={caseId} />
      <CaseSection title="Expenses" category="expenses" caseId={caseId} />
    </div>
  );
}
