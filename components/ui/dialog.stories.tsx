import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from './dialog';
import { Button } from './button';

/**
 * The Dialog component displays modal content overlaying the page.
 * Built on Radix UI Dialog for accessibility and keyboard navigation.
 *
 * ## Subcomponents
 * - **DialogTrigger**: Element that opens the dialog
 * - **DialogContent**: The modal container with overlay
 * - **DialogHeader**: Container for title and description
 * - **DialogTitle**: Accessible title (required for a11y)
 * - **DialogDescription**: Optional descriptive text
 * - **DialogFooter**: Container for action buttons
 * - **DialogClose**: Wraps elements that should close the dialog
 *
 * ## Accessibility
 * - Focus is trapped within the dialog when open
 * - Escape key closes the dialog
 * - Proper ARIA attributes for screen readers
 */
const meta: Meta<typeof Dialog> = {
  title: 'UI/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

// ============================================================================
// Basic Dialog
// ============================================================================

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            This is a description of what this dialog is about. It provides
            context for the user.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>Dialog content goes here. This can be any React content.</p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// ============================================================================
// Confirmation Dialog
// ============================================================================

export const Confirmation: Story = {
  args: {
    onOpenChange: fn(),
  },
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Case</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the case
            and all associated data including notes, financials, and activity
            history.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Confirmation dialog for destructive actions with warning styling.',
      },
    },
  },
};

// ============================================================================
// Form Dialog
// ============================================================================

export const FormDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Add Note</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Note</DialogTitle>
          <DialogDescription>
            Add a note to this case. Notes are visible to all team members.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="note-title" className="text-sm font-medium">
              Title
            </label>
            <input
              id="note-title"
              type="text"
              className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
              placeholder="Note title"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="note-content" className="text-sm font-medium">
              Content
            </label>
            <textarea
              id="note-content"
              className="flex min-h-[120px] w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              placeholder="Write your note here..."
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Save Note</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Dialog containing a form with inputs and validation.',
      },
    },
  },
};

// ============================================================================
// Without Close Button
// ============================================================================

export const NoCloseButton: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open (no X button)</Button>
      </DialogTrigger>
      <DialogContent hideCloseButton>
        <DialogHeader>
          <DialogTitle>Custom Close Handling</DialogTitle>
          <DialogDescription>
            This dialog hides the default close button. Use the footer buttons
            or Escape key to close.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Got it</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Dialog with `hideCloseButton` prop for custom close button placement.',
      },
    },
  },
};

// ============================================================================
// Scrollable Content
// ============================================================================

export const ScrollableContent: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>View Details</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Case Activity Log</DialogTitle>
          <DialogDescription>
            Complete history of actions taken on this case.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="border-b pb-3 last:border-0">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Activity {15 - i}</span>
                <span className="text-muted-foreground">
                  Dec {15 - i}, 2025
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore.
              </p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Dialog with scrollable content area for long lists or detailed information.',
      },
    },
  },
};
