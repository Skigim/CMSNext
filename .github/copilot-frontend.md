# Frontend & UI Guidelines

Focus: React components, shadcn/ui, Tailwind, accessibility.

## Component Library

- **Primary:** shadcn/ui primitives from `components/ui/*`
- **Styling:** Tailwind v4 tokens only - no divergent inline styles
- **Performance:** Memoize expensive components and selectors

## Component Structure

```typescript
// components/feature/MyComponent.tsx
export function MyComponent({ prop }: MyComponentProps) {
  // Use hooks for state and logic
  const { data, handleAction } = useFeatureHook();

  // Pure UI rendering - NO business logic here
  return (
    <Card>
      <CardHeader>
        <CardTitle>{data.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleAction}>Action</Button>
      </CardContent>
    </Card>
  );
}
```

### Rules

- Components are **UI only** - call hooks, never services directly
- Keep components focused and composable
- Extract complex logic to custom hooks

## shadcn/ui Components

Available in `components/ui/*`:

- Layout: `Card`, `Dialog`, `Drawer`, `Sheet`, `Tabs`
- Forms: `Button`, `Input`, `Select`, `Checkbox`, `Label`, `Textarea`
- Feedback: `Badge`, `Alert`, `Separator`
- Data: `Table`, `ScrollArea`

### Dialog Pattern

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description for accessibility</DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSubmit}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Feedback Patterns

### Notifications

```typescript
import { toast } from "sonner";

// Loading → Success/Error pattern
const toastId = toast.loading("Saving...");
try {
  await saveData();
  toast.success("Saved successfully", { id: toastId });
} catch (error) {
  toast.error("Failed to save", { id: toastId });
}
```

### Never Use

- ❌ `alert()`, `confirm()`, or browser dialogs
- ❌ Custom modal implementations (use shadcn Dialog)

## Theme System

8 themes in 4 families:

| Family  | Light         | Dark         |
| ------- | ------------- | ------------ |
| Neutral | `light`       | `dark`       |
| Slate   | `slate-light` | `slate-dark` |
| Stone   | `stone-light` | `stone-dark` |
| Zinc    | `zinc-light`  | `zinc-dark`  |

Access via `ThemeContext`.

## Color Slots

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

CSS variables: `--color-slot-{name}`, `--color-slot-{name}-bg`, `--color-slot-{name}-border`

## Accessibility

- Maintain focus management in modals
- Verify keyboard navigation paths
- Include `DialogDescription` for screen readers
- Use semantic HTML elements
- Test with jest-axe

## Tailwind Patterns

```tsx
// Use cn() for conditional classes
import { cn } from "@/lib/utils";

<div
  className={cn(
    "p-4 rounded-lg",
    isActive && "bg-primary text-primary-foreground",
    isDisabled && "opacity-50 cursor-not-allowed"
  )}
/>;
```

## File Locations

- **Components:** `components/*` (organized by feature)
- **UI Primitives:** `components/ui/*`
- **Styles:** `styles/globals.css`
