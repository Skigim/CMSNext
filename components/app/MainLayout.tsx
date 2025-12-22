import { ReactNode } from 'react';
import { AppView } from '@/types/view';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { useAutosaveStatus } from '@/hooks/useAutosaveStatus';
import { AutosaveStatusBadge } from './AutosaveStatusBadge';

interface BreadcrumbSegment {
  label: string;
  view?: AppView;
}

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

  const getBreadcrumbs = (): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [];
    
    // Always start with Dashboard as root (except when on dashboard)
    if (currentView !== 'dashboard') {
      segments.push({ label: 'Dashboard', view: 'dashboard' });
    }
    
    switch (currentView) {
      case 'dashboard':
        segments.push({ label: 'Dashboard' });
        break;
      case 'list':
        segments.push({ label: 'Cases' });
        break;
      case 'details':
        segments.push({ label: 'Cases', view: 'list' });
        segments.push({ label: breadcrumbTitle || 'Case Details' });
        break;
      case 'form':
        segments.push({ label: 'Cases', view: 'list' });
        segments.push({ label: breadcrumbTitle || 'New Case' });
        break;
      case 'reports':
        segments.push({ label: 'Reports' });
        break;
      case 'settings':
        segments.push({ label: 'Settings' });
        break;
      default:
        segments.push({ label: 'Dashboard' });
    }
    
    return segments;
  };

  const breadcrumbs = getBreadcrumbs();

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
                {breadcrumbs.map((segment, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  return (
                    <BreadcrumbItem key={`${segment.label}-${index}`}>
                      {index > 0 && <BreadcrumbSeparator />}
                      {isLast ? (
                        <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (segment.view) onNavigate(segment.view);
                          }}
                          className="cursor-pointer hover:text-foreground"
                        >
                          {segment.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  );
                })}
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