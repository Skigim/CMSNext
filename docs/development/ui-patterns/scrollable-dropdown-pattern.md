# Scrollable Dropdown Pattern

## Problem

Dropdown content (like search results, menus, or select options) can overflow beyond the container boundaries when the content list is long. This creates a poor UX where content extends beyond visible screen areas and doesn't properly scroll.

## Root Cause

Radix UI's `ScrollArea` component requires explicit height constraints to function properly. Simply applying Tailwind classes like `max-h-80` is insufficient because:

1. The parent container needs `overflow-hidden` to clip content
2. The `ScrollArea` needs both explicit height and proper flex layout
3. The dropdown wrapper must have a max-height to prevent infinite expansion

## Solution Pattern

### Required Structure

```tsx
<div
  className="absolute ... overflow-hidden flex flex-col"
  style={{ maxHeight: "32rem" }}
>
  <ScrollArea className="h-full max-h-80">
    {/* scrollable content */}
  </ScrollArea>
  {/* optional footer outside scroll area */}
</div>
```

### Key Elements

1. **Outer Container**: Must have:
   - `overflow-hidden` - clips content at boundaries
   - `flex flex-col` - enables proper height distribution
   - Inline `maxHeight` style - sets upper bound (prevents full-screen expansion)

2. **ScrollArea**: Must have:
   - `h-full` - takes available space from parent
   - `max-h-80` or similar - constraint for smaller viewports
   - Wraps only the scrollable content (not footers/headers)

3. **Footer/Header** (optional): Place outside `ScrollArea` for sticky behavior

## Implementation Example

### GlobalSearchDropdown (Fixed)

```tsx
{
  showDropdown && (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border bg-popover shadow-lg overflow-hidden flex flex-col"
      role="listbox"
      style={{ maxHeight: "32rem" }}
    >
      <ScrollArea className="h-full max-h-80">
        {isSearching ? (
          <div className="flex items-center justify-center py-6">
            {/* loading state */}
          </div>
        ) : hasResults ? (
          <div className="py-1">{/* results list */}</div>
        ) : (
          <div className="py-6 text-center">{/* no results */}</div>
        )}
      </ScrollArea>

      {/* Footer stays at bottom (outside ScrollArea) */}
      <div className="border-t px-3 py-2 text-xs">
        {/* keyboard shortcuts hint */}
      </div>
    </div>
  );
}
```

## Common Mistakes

### ❌ Missing overflow-hidden

```tsx
{
  /* BAD - content overflows */
}
<div className="absolute ... border bg-popover">
  <ScrollArea className="max-h-80">{/* content can escape */}</ScrollArea>
</div>;
```

### ❌ No flex layout

```tsx
{
  /* BAD - ScrollArea doesn't fill properly */
}
<div className="absolute ... overflow-hidden">
  <ScrollArea className="max-h-80">
    {/* height constraint doesn't work */}
  </ScrollArea>
</div>;
```

### ❌ Only Tailwind max-h

```tsx
{
  /* BAD - no height distribution */
}
<div className="absolute ... border bg-popover">
  <ScrollArea className="max-h-80">
    {/* doesn't properly constrain */}
  </ScrollArea>
</div>;
```

### ❌ Footer inside ScrollArea

```tsx
{
  /* BAD - footer scrolls with content */
}
<ScrollArea className="h-full max-h-80">
  <div className="py-1">{/* results */}</div>
  <div className="border-t px-3 py-2">{/* footer scrolls away */}</div>
</ScrollArea>;
```

## Testing Checklist

When implementing scrollable dropdowns:

- [ ] Test with varying content lengths (1, 10, 50+ items)
- [ ] Verify scrollbar appears when content exceeds container
- [ ] Confirm content doesn't overflow visible boundaries
- [ ] Check footer/header stays fixed (if applicable)
- [ ] Test on different viewport sizes (mobile, tablet, desktop)
- [ ] Verify keyboard navigation works (arrow keys, page up/down)
- [ ] Ensure proper focus management when scrolling
- [ ] Test with browser zoom (100%, 125%, 150%)

## When to Use This Pattern

Use this pattern for:

- Search result dropdowns
- Select/combobox options
- Autocomplete suggestions
- Filterable menus
- Command palettes
- Notification lists

## Related Components

- [GlobalSearchDropdown](../../components/app/GlobalSearchDropdown.tsx)
- [ScrollArea](../../components/ui/scroll-area.tsx)
- Command palette (if implemented)
- Select components with many options

## Browser Compatibility

This pattern relies on:

- CSS Flexbox (universal support)
- Radix UI ScrollArea (handles scrollbar across browsers)
- Modern CSS `overflow` handling

No known compatibility issues with browsers from 2020+.

## Performance Considerations

- For very large lists (100+ items), consider virtualization
- Use `react-window` or `@tanstack/react-virtual` for 500+ items
- Memoize item components to prevent unnecessary re-renders
- Debounce search input to reduce result updates

## References

- Radix UI ScrollArea docs: https://www.radix-ui.com/docs/primitives/components/scroll-area
- This bug was fixed on: January 21, 2026
- Related issue: Dashboard search dropdown content overflow
