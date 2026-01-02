import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Search as SearchIcon, Mail, DollarSign } from 'lucide-react';

import { Input } from './input';
import { Label } from './label';

/**
 * The Input component is a styled text input field.
 * Supports all native input types and states.
 *
 * ## Features
 * - Full support for native input types (text, email, password, number, etc.)
 * - Focus, disabled, and invalid states
 * - File input styling
 * - Placeholder styling
 */
const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'search', 'tel', 'url', 'file'],
      description: 'Input type',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the input',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
  },
  args: {
    onChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

// ============================================================================
// Basic Types
// ============================================================================

export const Default: Story = {
  args: {
    type: 'text',
    placeholder: 'Enter text...',
  },
};

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'name@example.com',
  },
};

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter password',
  },
};

export const Number: Story = {
  args: {
    type: 'number',
    placeholder: '0',
  },
};

export const Search: Story = {
  args: {
    type: 'search',
    placeholder: 'Search...',
  },
};

// ============================================================================
// States
// ============================================================================

export const Disabled: Story = {
  args: {
    type: 'text',
    placeholder: 'Disabled input',
    disabled: true,
  },
};

export const WithValue: Story = {
  args: {
    type: 'text',
    defaultValue: 'Pre-filled value',
  },
};

export const Invalid: Story = {
  args: {
    type: 'email',
    defaultValue: 'invalid-email',
    'aria-invalid': true,
  },
};

// ============================================================================
// File Input
// ============================================================================

export const FileInput: Story = {
  args: {
    type: 'file',
  },
};

export const FileInputMultiple: Story = {
  args: {
    type: 'file',
    multiple: true,
  },
};

// ============================================================================
// With Labels
// ============================================================================

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input type="email" id="email" placeholder="name@example.com" />
    </div>
  ),
};

export const WithLabelAndDescription: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="password">Password</Label>
      <Input type="password" id="password" placeholder="Enter password" />
      <p className="text-sm text-muted-foreground">
        Must be at least 8 characters
      </p>
    </div>
  ),
};

// ============================================================================
// With Icons (using wrapper)
// ============================================================================

export const WithIconLeft: Story = {
  render: () => (
    <div className="relative w-full max-w-sm">
      <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input type="search" placeholder="Search..." className="pl-8" />
    </div>
  ),
};

export const WithIconRight: Story = {
  render: () => (
    <div className="relative w-full max-w-sm">
      <Input type="email" placeholder="Email" className="pr-8" />
      <Mail className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    </div>
  ),
};

// ============================================================================
// Currency Input Example
// ============================================================================

export const CurrencyInput: Story = {
  render: () => (
    <div className="relative w-full max-w-sm">
      <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="number"
        placeholder="0.00"
        className="pl-8"
        step="0.01"
        min="0"
      />
    </div>
  ),
};

// ============================================================================
// Width Variations
// ============================================================================

export const FullWidth: Story = {
  args: {
    type: 'text',
    placeholder: 'Full width input',
    className: 'w-full',
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};

export const FixedWidth: Story = {
  args: {
    type: 'text',
    placeholder: 'Fixed width',
    className: 'w-48',
  },
};
