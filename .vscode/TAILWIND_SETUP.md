# Tailwind CSS Validation Setup

## Current Status

### ✅ Installed & Configured
- **Tailwind CSS IntelliSense Extension** (`bradlc.vscode-tailwindcss`)
  - Provides autocomplete for Tailwind classes
  - Shows warnings for unknown/invalid classes
  - Hover documentation for class utilities
  - Configured to work with `cn()` utility and className props

### ⚠️ Not Compatible
- **eslint-plugin-tailwindcss** - Cannot be installed
  - Requires Tailwind CSS v3.x
  - This project uses Tailwind CSS v4.x
  - Peer dependency conflict prevents installation
  
### 🔧 Configuration Files Added

1. **`.vscode/settings.json`**
   - Enhanced Tailwind IntelliSense configuration
   - Added validation rules (errors for invalid classes)
   - Custom regex patterns to detect classes in:
     - `cn()` utility (shadcn/ui)
     - `cva()` utility (class-variance-authority)
     - `cx()` utility
     - `className` props
     - `class` props
   - Enabled linting for CSS conflicts, invalid variants, etc.

2. **`.vscode/extensions.json`**
   - Recommends Tailwind CSS IntelliSense extension
   - Recommends ESLint extension
   - Recommends Prettier extension

## How It Works Now

With the IntelliSense extension installed, you'll get:

1. **Autocomplete** - Type a class name and see valid suggestions
2. **Warnings** - Invalid classes like `rounded-xs` will show yellow squiggly underlines
3. **Hover Docs** - Hover over a class to see its CSS output
4. **Color Preview** - See color swatches for color utilities

## Future: ESLint Plugin

When `eslint-plugin-tailwindcss` adds support for Tailwind v4, install it with:

```bash
npm install -D eslint-plugin-tailwindcss
```

Then add to `eslint.config.js`:
```javascript
import tailwindcss from 'eslint-plugin-tailwindcss';

export default [
  // ... existing config
  {
    plugins: {
      tailwindcss,
    },
    rules: {
      'tailwindcss/classnames-order': 'warn',
      'tailwindcss/no-custom-classname': 'warn',
      'tailwindcss/no-contradicting-classname': 'error',
    },
  },
];
```

This would catch invalid classes at lint/build time, not just in the editor.

## Reload Required

After these changes, reload VS Code window to activate all settings:
- Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
- Type "Reload Window"
- Press Enter

The Tailwind IntelliSense should now be fully active!
