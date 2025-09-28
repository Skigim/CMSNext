import { memo, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { CaseDisplay } from "@/types/case";
import { CaseStatusBadge } from "./CaseStatusBadge";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

export interface CaseTableProps {
  cases: CaseDisplay[];
  onViewCase: (caseId: string) => void;
  onEditCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
}

const formatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatter.format(date);
}

export const CaseTable = memo(function CaseTable({ cases, onViewCase, onEditCase, onDeleteCase }: CaseTableProps) {
  const hasCases = cases.length > 0;

  const rows = useMemo(() => cases.map(item => {
    const caseType = item.caseRecord?.caseType || "Not specified";
    const applicationDate = item.caseRecord?.applicationDate || item.createdAt;
    const updatedDate = item.updatedAt || item.caseRecord?.updatedDate || item.createdAt;
    const primaryContact = item.person?.phone || item.person?.email || "Not provided";

    return {
      id: item.id,
      name: item.name || "Unnamed Case",
      mcn: item.mcn || "No MCN",
      status: item.status,
      priority: item.priority,
      caseType,
      applicationDate: formatDate(applicationDate),
      updatedDate: formatDate(updatedDate),
      primaryContact,
    };
  }), [cases]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Case type</TableHead>
            <TableHead>Application</TableHead>
            <TableHead>Last updated</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="w-0 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!hasCases && (
            <TableRow>
              <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                No cases to display
              </TableCell>
            </TableRow>
          )}
          {rows.map(row => (
            <TableRow key={row.id} className="group">
              <TableCell>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="link"
                      className="h-auto w-fit p-0 text-base"
                      onClick={() => onViewCase(row.id)}
                    >
                      {row.name}
                    </Button>
                    {row.priority && (
                      <span
                        className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500"
                        role="img"
                        aria-label="High priority case"
                        title="High priority case"
                      />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">MCN: {row.mcn}</span>
                </div>
              </TableCell>
              <TableCell>
                <CaseStatusBadge status={row.status} />
              </TableCell>
              <TableCell>{row.caseType}</TableCell>
              <TableCell>{row.applicationDate}</TableCell>
              <TableCell>{row.updatedDate}</TableCell>
              <TableCell>
                <span className="block max-w-[16rem] truncate" title={row.primaryContact}>
                  {row.primaryContact}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onViewCase(row.id)}>
                      <Eye className="mr-2 h-4 w-4" /> View case
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEditCase(row.id)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit case
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onDeleteCase(row.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete case
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});
