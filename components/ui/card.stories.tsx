import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from './card';
import { Button } from './button';

/**
 * The Card component provides a flexible container for grouping related content.
 *
 * ## Subcomponents
 * - **CardHeader**: Contains title, description, and optional action slot
 * - **CardTitle**: Primary heading for the card
 * - **CardDescription**: Secondary text describing the card content
 * - **CardAction**: Slot for action buttons in the header (auto-positioned)
 * - **CardContent**: Main content area
 * - **CardFooter**: Footer area, typically for actions
 */
const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

// ============================================================================
// Basic Usage
// ============================================================================

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content with any custom layout or components.</p>
      </CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  ),
};

// ============================================================================
// With Header Action
// ============================================================================

export const WithHeaderAction: Story = {
  render: () => (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Case #12345</CardTitle>
        <CardDescription>Created on Dec 15, 2025</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span>Active</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Priority</span>
            <span>High</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assigned To</span>
            <span>Jane Smith</span>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Card with an action button in the header using CardAction slot.',
      },
    },
  },
};

// ============================================================================
// Minimal Card
// ============================================================================

export const Minimal: Story = {
  render: () => (
    <Card className="w-[300px]">
      <CardContent className="pt-6">
        <p className="text-center text-muted-foreground">
          Simple card with only content.
        </p>
      </CardContent>
    </Card>
  ),
};

// ============================================================================
// Interactive Card
// ============================================================================

export const Interactive: Story = {
  render: () => (
    <Card className="w-[350px] cursor-pointer transition-shadow hover:shadow-lg">
      <CardHeader>
        <CardTitle>Clickable Card</CardTitle>
        <CardDescription>This card responds to hover.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Hover over this card to see the shadow effect. Useful for navigation
          cards or selectable items.
        </p>
      </CardContent>
    </Card>
  ),
};

// ============================================================================
// Stats Card
// ============================================================================

export const StatsCard: Story = {
  render: () => (
    <div className="flex gap-4">
      <Card className="w-[180px]">
        <CardHeader className="pb-2">
          <CardDescription>Total Cases</CardDescription>
          <CardTitle className="text-3xl">1,234</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">+12% from last month</p>
        </CardContent>
      </Card>
      <Card className="w-[180px]">
        <CardHeader className="pb-2">
          <CardDescription>Active Alerts</CardDescription>
          <CardTitle className="text-3xl text-destructive">23</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">5 critical</p>
        </CardContent>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Cards styled as metric/stats displays with emphasized numbers.',
      },
    },
  },
};

// ============================================================================
// Form Card
// ============================================================================

export const FormCard: Story = {
  render: () => (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Create New Case</CardTitle>
        <CardDescription>
          Fill in the details below to create a new case.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Case Number</label>
            <input
              type="text"
              className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
              placeholder="Enter case number"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              placeholder="Enter description"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Create Case</Button>
      </CardFooter>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Card containing a form with header, content, and footer actions.',
      },
    },
  },
};
