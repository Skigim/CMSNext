import { memo } from "react";
import type { CaseDisplay } from "@/types/case";
import { CaseStatusBadge } from "./CaseStatusBadge";
import { useCaseStatusMenu } from "./useCaseStatusMenu";

export interface CaseStatusMenuProps {
  caseId: string;
  status?: CaseDisplay["status"];
  onUpdateStatus?: (
    caseId: string,
    status: CaseDisplay["status"],
  ) => Promise<CaseDisplay | null> | CaseDisplay | null | void;
}

export const CaseStatusMenu = memo(function CaseStatusMenu({
  caseId,
  status,
  onUpdateStatus,
}: CaseStatusMenuProps) {
  const { status: effectiveStatus, handleStatusChange } = useCaseStatusMenu({
    caseId,
    status,
    onUpdateStatus,
  });

  return (
    <CaseStatusBadge
      status={effectiveStatus}
      onStatusChange={onUpdateStatus ? handleStatusChange : undefined}
    />
  );
});

export default CaseStatusMenu;
