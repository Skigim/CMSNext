import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import {
  FileText,
  Clock,
  Plus,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Coins,
  TrendingUp,
} from "lucide-react";
import { CaseDisplay } from "../../types/case";
import { FileServiceDiagnostic } from "../diagnostics/FileServiceDiagnostic";

interface DashboardProps {
  cases: CaseDisplay[];
  onViewAllCases: () => void;
  onNewCase: () => void;
}

export function Dashboard({ cases, onViewAllCases, onNewCase }: DashboardProps) {
  // Helper function to safely filter cases
  const getValidCases = () => cases.filter(c => c && c.caseRecord && typeof c.caseRecord === 'object');
  
  const totalCases = cases.length;
  const statusCount = (status: CaseDisplay['status']) =>
    getValidCases().filter(c => c.caseRecord.status === status).length;

  const pendingCases = statusCount('Pending');
  const approvedCases = statusCount('Approved');
  const deniedCases = statusCount('Denied');
  const spenddownCases = statusCount('Spenddown');
  const recentCases = getValidCases().slice(0, 5); // Show 5 most recent cases

  const stats = [
    {
      title: "Total Cases",
      value: totalCases,
      description: "All tracked cases",
      icon: FileText,
      color: "text-blue-600"
    },
    {
      title: "Pending Cases",
      value: pendingCases,
      description: "Awaiting determination",
      icon: Clock,
      color: "text-amber-600"
    },
    {
      title: "Approved Cases",
      value: approvedCases,
      description: "Cleared for services",
      icon: CheckCircle2,
      color: "text-emerald-600"
    },
    {
      title: "Denied Cases",
      value: deniedCases,
      description: "Require follow-up",
      icon: XCircle,
      color: "text-red-600"
    },
    {
      title: "Spenddown Cases",
      value: spenddownCases,
      description: "Managing spenddown requirements",
      icon: Coins,
      color: "text-purple-600"
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your case management system</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onNewCase} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Case
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      <div className="text-sm text-muted-foreground">
                        MCN: {case_.caseRecord?.mcn || 'N/A'} • Status: {case_.caseRecord?.status || 'Unknown'}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {case_.caseRecord?.createdDate ? new Date(case_.caseRecord.createdDate).toLocaleDateString() : 'No date'}
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start h-auto p-4"
                onClick={onNewCase}
              >
                <div className="flex items-center w-full">
                  <Plus className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Create New Case</div>
                    <div className="text-sm text-muted-foreground">Add a new case to the system</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start h-auto p-4"
                onClick={onViewAllCases}
              >
                <div className="flex items-center w-full">
                  <FileText className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">View All Cases</div>
                    <div className="text-sm text-muted-foreground">Browse and manage existing cases</div>
                  </div>
                </div>
              </Button>



              <Button 
                variant="outline" 
                className="w-full justify-start h-auto p-4"
                disabled
              >
                <div className="flex items-center w-full">
                  <TrendingUp className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Reports</div>
                    <div className="text-sm text-muted-foreground">Generate case reports (Coming soon)</div>
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for future dashboard widgets */}
      <Card>
        <CardHeader>
          <CardTitle>Analytics Overview</CardTitle>
          <CardDescription>Case management insights and trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium mb-2">Analytics Coming Soon</h3>
            <p className="text-sm">
              Charts and insights about your case management will appear here.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Temporary diagnostic tool */}
      <FileServiceDiagnostic />

    </div>
  );
}

export default Dashboard;