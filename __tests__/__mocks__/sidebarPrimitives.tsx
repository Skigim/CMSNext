import type { ComponentProps, ReactNode } from "react";

export function ThemeToggle() {
  return <button type="button">Theme</button>;
}

export function createSidebarLayoutModuleMock() {
  return {
    SidebarProvider: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarInset: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarTrigger: () => <button type="button">Toggle Sidebar</button>,
  };
}

export function createSidebarModuleMock({
  isMobile = false,
  setOpen,
  setOpenMobile,
}: {
  isMobile?: boolean;
  setOpen: (open: boolean) => void;
  setOpenMobile: (open: boolean) => void;
}) {
  return {
    Sidebar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SidebarContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarFooter: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarGroup: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarGroupContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarGroupLabel: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarHeader: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarMenu: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarMenuButton: ({
      children,
      isActive,
      ...props
    }: ComponentProps<"button"> & { isActive?: boolean }) => (
      <button data-active={isActive} type="button" {...props}>
        {children}
      </button>
    ),
    SidebarMenuItem: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    useSidebar: () => ({
      isMobile,
      setOpen,
      setOpenMobile,
    }),
  };
}
