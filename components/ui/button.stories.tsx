import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Mail, Loader2, ChevronRight, Plus } from 'lucide-react';

import { Button } from './button';

/**
 * The Button component is used to trigger actions or events.
 * Built on Radix UI Slot for composability with `asChild` prop.
 *
 * ## Variants
 * - **default**: Primary action button
 * - **secondary**: Secondary actions
 * - **destructive**: Dangerous/irreversible actions
 * - **outline**: Subtle bordered button
 * - **ghost**: Minimal, no background until hover
 * - **link**: Styled as a hyperlink
 *
 * ## Sizes
 * - **default**: Standard size (h-9)
 * - **sm**: Small size (h-8)
 * - **lg**: Large size (h-10)
 * - **icon**: Square icon button (size-9)
 * - **icon-sm**: Small square icon button (size-8)
 * - **icon-lg**: Large square icon button (size-10)
 */
const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon', 'icon-sm', 'icon-lg'],
      description: 'Size variant',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the button',
    },
    asChild: {
      control: 'boolean',
      description: 'Render as child element (for composability)',
    },
  },
  args: {
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ============================================================================
// Basic Variants
// ============================================================================

export const Default: Story = {
  args: {
    children: 'Button',
    variant: 'default',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Secondary',
    variant: 'secondary',
  },
};

export const Destructive: Story = {
  args: {
    children: 'Delete',
    variant: 'destructive',
  },
};

export const Outline: Story = {
  args: {
    children: 'Outline',
    variant: 'outline',
  },
};

export const Ghost: Story = {
  args: {
    children: 'Ghost',
    variant: 'ghost',
  },
};

export const Link: Story = {
  args: {
    children: 'Link Button',
    variant: 'link',
  },
};

// ============================================================================
// Sizes
// ============================================================================

export const Small: Story = {
  args: {
    children: 'Small',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    children: 'Large',
    size: 'lg',
  },
};

// ============================================================================
// With Icons
// ============================================================================

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Mail />
        Login with Email
      </>
    ),
  },
};

export const IconRight: Story = {
  args: {
    children: (
      <>
        Next
        <ChevronRight />
      </>
    ),
  },
};

export const IconOnly: Story = {
  args: {
    size: 'icon',
    children: <Plus />,
    'aria-label': 'Add item',
  },
};

// ============================================================================
// States
// ============================================================================

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    disabled: true,
    children: (
      <>
        <Loader2 className="animate-spin" />
        Please wait
      </>
    ),
  },
};

// ============================================================================
// All Variants Gallery
// ============================================================================

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All button variants displayed together for comparison.',
      },
    },
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon-sm">
        <Plus />
      </Button>
      <Button size="icon">
        <Plus />
      </Button>
      <Button size="icon-lg">
        <Plus />
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All button sizes displayed together for comparison.',
      },
    },
  },
};
