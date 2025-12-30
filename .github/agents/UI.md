# Agent Instructions: UI & Components

## Overview

The UI layer uses React with TypeScript. Components are purely presentational—they call hooks for state and actions, never services directly. All components use shadcn/ui primitives styled with Tailwind CSS v4.

## Key Files

| File                      | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `App.tsx`                 | Root component, composes providers and routing    |
| `components/ui/*.tsx`     | shadcn/ui primitives (Button, Card, Dialog, etc.) |
| `components/app/*.tsx`    | Application-specific composed components          |
| `components/case/*.tsx`   | Case-related components                           |
| `components/modals/*.tsx` | Modal dialogs                                     |
| `components/forms/*.tsx`  | Form components                                   |
| `contexts/*.tsx`          | React context providers                           |
| `styles/globals.css`      | Tailwind base styles and CSS variables            |

## Architecture

```
App.tsx
├── Providers (Theme, FileStorage, DataManager, etc.)
│   └── Main Application
│       ├── Header / Navigation
│       ├── Case List / Dashboard
│       ├── Case Detail Views
│       └── Modals (Dialog, Sheet, etc.)
```

**Components receive data through props and hooks. They never import services directly.**

## Patterns

### Component Structure

```typescript
/**
 * Brief component description.
 */

import type { FC } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFeatureHook } from "@/hooks/useFeatureHook";

interface MyComponentProps {
  caseId: string;
  onAction?: () => void;
}

export const MyComponent: FC<MyComponentProps> = ({ caseId, onAction }) => {
  // Use hooks for state and logic
  const { data, isLoading, handleSubmit } = useFeatureHook(caseId);

  if (isLoading) {
    return <Skeleton />;
  }

  // Pure UI rendering - NO business logic here
  return (
    <Card>
      <CardHeader>
        <CardTitle>{data.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleSubmit}>Submit</Button>
      </CardContent>
    </Card>
  );
};
```

### Dialog Pattern

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface EditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: SomeData;
  onSave: (data: SomeData) => void;
}

export const EditDialog: FC<EditDialogProps> = ({
  open,
  onOpenChange,
  data,
  onSave,
}) => {
  const [formData, setFormData] = useState(data);

  const handleSubmit = () => {
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>Make changes to your item here.</DialogDescription>
        </DialogHeader>

        {/* Form content */}
        <div className="space-y-4">
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

### Notification Pattern (Sonner)

```typescript
import { toast } from "sonner";

// Simple notifications
toast.success("Case saved successfully");
toast.error("Failed to save case");

// Loading → Success/Error transition
const handleSave = async () => {
  const toastId = toast.loading("Saving...");
  try {
    await saveData();
    toast.success("Saved successfully", { id: toastId });
  } catch (error) {
    toast.error("Failed to save", { id: toastId });
  }
};
```

## shadcn/ui Components

Available in `components/ui/*`:

| Category       | Components                                                   |
| -------------- | ------------------------------------------------------------ |
| **Layout**     | `Card`, `Dialog`, `Drawer`, `Sheet`, `Tabs`, `Separator`     |
| **Forms**      | `Button`, `Input`, `Select`, `Checkbox`, `Label`, `Textarea` |
| **Feedback**   | `Badge`, `Alert`, `Skeleton`                                 |
| **Data**       | `Table`, `ScrollArea`                                        |
| **Navigation** | `DropdownMenu`, `Command`                                    |

## Theme System

8 themes in 4 families:

| Family  | Light         | Dark         |
| ------- | ------------- | ------------ |
| Neutral | `light`       | `dark`       |
| Slate   | `slate-light` | `slate-dark` |
| Stone   | `stone-light` | `stone-dark` |
| Zinc    | `zinc-light`  | `zinc-dark`  |

Access via `useTheme()` from `ThemeContext`.

### Color Slots

10 semantic colors for status customization:

```typescript
type ColorSlot =
  | "blue"
  | "green"
  | "red"
  | "amber"
  | "purple"
  | "slate"
  | "teal"
  | "rose"
  | "orange"
  | "cyan";
```

CSS variables per slot: `--color-slot-{name}`, `--color-slot-{name}-bg`, `--color-slot-{name}-border`

## Accessibility

- All dialogs must have `DialogTitle` and `DialogDescription`
- Use semantic HTML elements via shadcn components
- Maintain focus management in modals
- Test keyboard navigation paths
- Run axe checks for new components

## Verification

After making UI changes:

1. **Build passes:** `npm run build`
2. **No type errors:** `npx tsc --noEmit`
3. **Visual check:** `npm run dev` and inspect the UI
4. **Responsive:** Check at different viewport sizes
5. **Accessibility:** Run axe check in tests
6. **Theme support:** Verify component works in all themes

## Common Pitfalls

| ❌ Don't                         | ✅ Do                                    |
| -------------------------------- | ---------------------------------------- |
| Import services directly         | Use hooks for data/actions               |
| Use `alert()` or `confirm()`     | Use toast or Dialog                      |
| Use raw HTML elements            | Use shadcn/ui components                 |
| Put business logic in components | Keep components purely presentational    |
| Inline styles                    | Use Tailwind classes                     |
| Skip accessibility               | Include DialogDescription, proper ARIA   |
| Forget loading states            | Show Skeleton during loading             |
| Ignore theme support             | Use CSS variables, not hard-coded colors |
