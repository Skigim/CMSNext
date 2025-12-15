import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";
import { CopyButton } from "@/components/common/CopyButton";
import { formatDateForDisplay } from "@/utils/dateFormatting";
import type { StoredCase } from "@/types/case";
import { useMemo } from "react";

interface RecentCasesWidgetProps {
  cases: StoredCase[];
  onViewAllCases: () => void;
  onNewCase: () => void;
}

export function RecentCasesWidget({ cases, onViewAllCases, onNewCase }: RecentCasesWidgetProps) {
  const validCases = useMemo(
    () => cases.filter(c => c && c.caseRecord && typeof c.caseRecord === "object"),
    [cases],
  );

  const recentCases = validCases.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Cases</CardTitle>
            <CardDescription>Latest cases added to the system</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onViewAllCases}>
            View All
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recentCases.length > 0 ? (
          <div className="space-y-3">
            {recentCases.map((case_) => (
              <div key={case_.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                <div className="flex-1">
                  <div className="font-medium text-foreground">
                    {case_.person.firstName} {case_.person.lastName}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <CopyButton
                      value={case_.caseRecord?.mcn ?? null}
                      label="MCN"
                      mono
                      className="inline-flex items-center gap-1 text-muted-foreground"
                      labelClassName="text-sm font-normal text-muted-foreground"
                      buttonClassName="text-sm text-muted-foreground"
                      textClassName="text-sm"
                      missingLabel="MCN unavailable"
                      missingClassName="text-sm text-muted-foreground"
                      variant="plain"
                    />
                    <span>• Status: {case_.caseRecord?.status || 'Unknown'}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {case_.caseRecord?.createdDate ? formatDateForDisplay(case_.caseRecord.createdDate) : 'No date'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No cases yet</p>
            <Button variant="outline" size="sm" onClick={onNewCase} className="mt-2">
              Create your first case
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
