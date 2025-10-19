import { ReactNode } from 'react';
import { AppView } from '@/types/view';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { useAutosaveStatus } from '@/hooks/useAutosaveStatus';
import { AutosaveStatusBadge } from './AutosaveStatusBadge';

interface MainLayoutProps {
  children: ReactNode;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onNewCase: () => void;
  breadcrumbTitle?: string;
  sidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
}

export function MainLayout({ 
  children, 
  currentView, 
  onNavigate, 
  onNewCase,
  breadcrumbTitle,
  sidebarOpen,
  onSidebarOpenChange
}: MainLayoutProps) {
  const autosaveStatus = useAutosaveStatus();

  const getBreadcrumbTitle = () => {
    if (breadcrumbTitle) return breadcrumbTitle;
    
    switch (currentView) {
      case 'dashboard':
        return 'Dashboard';
      case 'list':
        return 'Cases';
      case 'details':
        return 'Case Details';
      case 'form':
        return 'Case Form';
      case 'reports':
        return 'Reports';
      case 'settings':
        return 'Settings';
      default:
        return 'Dashboard';
    }
  };

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={onSidebarOpenChange}
    >
      <AppSidebar 
        currentView={currentView}
        onNavigate={onNavigate}
        onNewCase={onNewCase}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{getBreadcrumbTitle()}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <AutosaveStatusBadge summary={autosaveStatus} />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 p-4">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}