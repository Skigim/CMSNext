import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bug, 
  Download, 
  Trash2, 
  Clock, 
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Tag
} from 'lucide-react';
import { useErrorReporting } from '@/utils/errorReporting';
import { toLocalDateString } from '@/domain/common';
import { toast } from 'sonner';

export function ErrorReportViewer() {
  const { getReports, clearReports, exportReports, getErrorStats } = useErrorReporting();
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  
  const reports = getReports();
  const stats = getErrorStats();

  const handleClearReports = () => {
    clearReports();
    toast.success('Error reports cleared');
  };

  const handleExportReports = () => {
    try {
      const data = exportReports();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cmsnext-error-reports-${toLocalDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Error reports exported');
    } catch (err) {
      toast.error('Failed to export error reports');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'high':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Info className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'secondary';
      case 'medium':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
  };

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-primary" />
            <CardTitle>Error Reports</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {reports.length > 0 && (
              <>
                <Button
                  onClick={handleExportReports}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
                <Button
                  onClick={handleClearReports}
                  variant="outline"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </>
            )}
          </div>
        </div>
        <CardDescription>
          Error tracking and reporting for debugging (Development only)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Errors</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-foreground">{stats.recent}</div>
            <div className="text-sm text-muted-foreground">Last 24h</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-destructive">
              {stats.severity.critical || 0}
            </div>
            <div className="text-sm text-muted-foreground">Critical</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-orange-500">
              {stats.severity.high || 0}
            </div>
            <div className="text-sm text-muted-foreground">High</div>
          </div>
        </div>

        {reports.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No error reports yet. This is good! Errors will be automatically tracked and displayed here.
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="border border-border rounded-lg p-3 bg-card"
                >
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedReport(
                      expandedReport === report.id ? null : report.id
                    )}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedReport(expandedReport === report.id ? null : report.id); } }}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getSeverityIcon(report.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getSeverityColor(report.severity)}>
                            {report.severity}
                          </Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(report.timestamp)}
                          </span>
                        </div>
                        <div className="font-medium text-sm truncate">
                          {report.error.name}: {report.error.message}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {report.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              <Tag className="h-2 w-2 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                          {report.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{report.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {expandedReport === report.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>

                  {expandedReport === report.id && (
                    <>
                      <Separator className="my-3" />
                      <div className="space-y-3 text-sm">
                        <div>
                          <div className="font-medium mb-1">Error Details</div>
                          <div className="bg-muted p-2 rounded text-xs font-mono">
                            <div className="text-destructive font-semibold">
                              {report.error.name}: {report.error.message}
                            </div>
                            {report.error.stack && (
                              <pre className="mt-1 text-muted-foreground whitespace-pre-wrap">
                                {report.error.stack.slice(0, 500)}
                                {report.error.stack.length > 500 && '...'}
                              </pre>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="font-medium mb-1">Context</div>
                          <div className="bg-muted p-2 rounded text-xs">
                            <div><strong>URL:</strong> {report.context.url}</div>
                            <div><strong>User Agent:</strong> {report.context.userAgent}</div>
                            {report.context.componentStack && (
                              <div>
                                <strong>Component Stack:</strong>
                                <pre className="mt-1 text-muted-foreground whitespace-pre-wrap">
                                  {report.context.componentStack.slice(0, 200)}...
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="font-medium mb-1">All Tags</div>
                          <div className="flex flex-wrap gap-1">
                            {report.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {report.userFeedback && (
                          <div>
                            <div className="font-medium mb-1">User Feedback</div>
                            <div className="bg-muted p-2 rounded text-xs">
                              <div>{report.userFeedback.description}</div>
                              {report.userFeedback.email && (
                                <div className="mt-1">
                                  <strong>Email:</strong> {report.userFeedback.email}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

