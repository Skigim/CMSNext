import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { User, Settings, CreditCard, FileText } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Input } from './input';
import { Label } from './label';

/**
 * Tabs organize content into separate views where only one view is visible at a time.
 * Built on Radix UI Tabs.
 *
 * ## Composition
 * - `Tabs`: Root container
 * - `TabsList`: Container for tab triggers
 * - `TabsTrigger`: Clickable tab button
 * - `TabsContent`: Panel content for each tab
 */
const meta: Meta<typeof Tabs> = {
  title: 'UI/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    onValueChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

// ============================================================================
// Basic Example
// ============================================================================

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="account" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Make changes to your account here. Click save when you&apos;re done.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue="John Doe" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input id="username" defaultValue="@johndoe" />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="password">
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Change your password here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="current">Current password</Label>
              <Input id="current" type="password" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new">New password</Label>
              <Input id="new" type="password" />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  ),
};

// ============================================================================
// With Icons
// ============================================================================

export const WithIcons: Story = {
  render: () => (
    <Tabs defaultValue="profile" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="profile">
          <User className="h-4 w-4 mr-1" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="settings">
          <Settings className="h-4 w-4 mr-1" />
          Settings
        </TabsTrigger>
        <TabsTrigger value="billing">
          <CreditCard className="h-4 w-4 mr-1" />
          Billing
        </TabsTrigger>
      </TabsList>
      <TabsContent value="profile" className="p-4">
        <p className="text-sm text-muted-foreground">
          Manage your profile settings and preferences.
        </p>
      </TabsContent>
      <TabsContent value="settings" className="p-4">
        <p className="text-sm text-muted-foreground">
          Configure your application settings.
        </p>
      </TabsContent>
      <TabsContent value="billing" className="p-4">
        <p className="text-sm text-muted-foreground">
          View and manage your billing information.
        </p>
      </TabsContent>
    </Tabs>
  ),
};

// ============================================================================
// Simple (No Card)
// ============================================================================

export const Simple: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="pt-4">
        <h3 className="font-medium">Overview</h3>
        <p className="text-sm text-muted-foreground mt-2">
          This is the overview tab content. It provides a summary of your data.
        </p>
      </TabsContent>
      <TabsContent value="analytics" className="pt-4">
        <h3 className="font-medium">Analytics</h3>
        <p className="text-sm text-muted-foreground mt-2">
          View your analytics and metrics here.
        </p>
      </TabsContent>
      <TabsContent value="reports" className="pt-4">
        <h3 className="font-medium">Reports</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Generate and download reports from this tab.
        </p>
      </TabsContent>
    </Tabs>
  ),
};

// ============================================================================
// Disabled Tab
// ============================================================================

export const WithDisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="active" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="disabled" disabled>
          Disabled
        </TabsTrigger>
        <TabsTrigger value="archived">Archived</TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="pt-4">
        <p className="text-sm text-muted-foreground">
          This tab is active and clickable.
        </p>
      </TabsContent>
      <TabsContent value="archived" className="pt-4">
        <p className="text-sm text-muted-foreground">
          View archived items here.
        </p>
      </TabsContent>
    </Tabs>
  ),
};

// ============================================================================
// Full Width
// ============================================================================

export const FullWidth: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-full max-w-lg">
      <TabsList className="w-full">
        <TabsTrigger value="tab1" className="flex-1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2" className="flex-1">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3" className="flex-1">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="pt-4">
        <p className="text-sm text-muted-foreground">Content for Tab 1</p>
      </TabsContent>
      <TabsContent value="tab2" className="pt-4">
        <p className="text-sm text-muted-foreground">Content for Tab 2</p>
      </TabsContent>
      <TabsContent value="tab3" className="pt-4">
        <p className="text-sm text-muted-foreground">Content for Tab 3</p>
      </TabsContent>
    </Tabs>
  ),
};

// ============================================================================
// Many Tabs
// ============================================================================

export const ManyTabs: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-full max-w-xl">
      <TabsList>
        <TabsTrigger value="tab1">
          <FileText className="h-4 w-4" />
        </TabsTrigger>
        <TabsTrigger value="tab2">
          <User className="h-4 w-4" />
        </TabsTrigger>
        <TabsTrigger value="tab3">
          <Settings className="h-4 w-4" />
        </TabsTrigger>
        <TabsTrigger value="tab4">
          <CreditCard className="h-4 w-4" />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="pt-4">Documents</TabsContent>
      <TabsContent value="tab2" className="pt-4">Users</TabsContent>
      <TabsContent value="tab3" className="pt-4">Settings</TabsContent>
      <TabsContent value="tab4" className="pt-4">Billing</TabsContent>
    </Tabs>
  ),
};
