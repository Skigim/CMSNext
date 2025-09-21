import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";
import { ThemeToggle } from './ThemeToggle';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings,
  Plus
} from 'lucide-react';

interface AppSidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onNewCase: () => void;
}

export function AppSidebar({ 
  currentView, 
  onNavigate, 
  onNewCase
}: AppSidebarProps) {
  const menuItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      view: "dashboard",
      id: "dashboard",
    },
    {
      title: "Cases",
      icon: Users,
      view: "cases", 
      id: "cases",
    },
    {
      title: "Settings",
      icon: Settings,
      view: "settings",
      id: "settings",
    },
  ];

  const isActiveItem = (itemView: string) => {
    if (itemView === 'dashboard') {
      return currentView === 'dashboard';
    }
    if (itemView === 'cases') {
      return ['list', 'details', 'form'].includes(currentView);
    }
    if (itemView === 'settings') {
      return currentView === 'settings';
    }
    return currentView === itemView;
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-2">
          <FileText className="h-6 w-6 text-sidebar-primary" />
          <span className="font-semibold text-sidebar-foreground">Case Tracker</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onNavigate(item.view)}
                    isActive={isActiveItem(item.view)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onNewCase}>
                  <Plus className="h-4 w-4" />
                  <span>New Case</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center space-x-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground">
                Case Tracking Platform
              </p>
              <p className="text-xs text-sidebar-foreground/60">
                Filesystem Storage
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}