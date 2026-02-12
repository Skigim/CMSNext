import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createLocalStorageAdapter } from '../utils/localStorage';

/**
 * Theme identifier type - one of four available themes.
 * @typedef {'light' | 'dark' | 'paperwhite' | 'sterling'} Theme
 */
type Theme = 'light' | 'dark' | 'paperwhite' | 'sterling';

/**
 * Theme tone categorization - either light or dark.
 * Used for components that need a simple dark/light distinction.
 * @typedef {'light' | 'dark'} ThemeTone
 */
type ThemeTone = 'light' | 'dark';

/**
 * Theme option metadata.
 * @interface ThemeOption
 */
interface ThemeOption {
  /** Unique theme identifier */
  id: Theme;
  /** Display name for the theme */
  name: string;
  /** User-friendly description */
  description: string;
}

/**
 * Available theme options with metadata.
 * 
 * - **light**: Clean bright white, high contrast
 * - **paperwhite**: Warm cream, easy on the eyes, reduced blue light
 * - **sterling**: Soft gray, middle ground between light and dark
 * - **dark**: Deep blue-gray, low light mode
 * 
 * @constant
 * @type {ThemeOption[]}
 */
export const themeOptions: ThemeOption[] = [
  { id: 'light', name: 'Light', description: 'Clean bright white' },
  { id: 'paperwhite', name: 'Paperwhite', description: 'Warm cream, easy on the eyes' },
  { id: 'sterling', name: 'Sterling', description: 'Soft gray, between light and dark' },
  { id: 'dark', name: 'Dark', description: 'Deep blue-gray' },
];

/**
 * Theme context value - provides theme state and control.
 * @interface ThemeContextType
 */
interface ThemeContextType {
  /** Currently active theme */
  theme: Theme;
  /** Theme tone categorization (light or dark) */
  tone: ThemeTone;
  /** Whether current theme is dark (convenient boolean) */
  isDark: boolean;
  /** Cycle to next theme in rotation */
  toggleTheme: () => void;
  /** Change to specific theme */
  setTheme: (theme: Theme) => void;
  /** Available theme options with metadata */
  themeOptions: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * LocalStorage adapter for theme persistence.
 * Uses the standardized key naming convention: cmsnext-<feature>
 */
const themeStorage = createLocalStorageAdapter<Theme | null>('cmsnext-theme', null, {
  // Parse with validation - reject invalid theme values
  parse: (s: string) => {
    const value = JSON.parse(s) as Theme | null;
    if (value && themeOptions.some(opt => opt.id === value)) {
      return value;
    }
    return null;
  },
});

/**
 * ThemeProvider - Manages application theme selection and persistence.
 * 
 * Provides theme switching with automatic persistence to localStorage.
 * Respects system color scheme preference on first load if no saved preference.
 * 
 * ## Supported Themes
 * 
 * Four themes in two categories:
 * 
 * **Light Themes:**
 * - `light`: High contrast white background
 * - `paperwhite`: Warm cream background (reduced blue light)
 * 
 * **Dark Themes:**
 * - `sterling`: Soft gray (middle ground)
 * - `dark`: Deep blue-gray (full dark mode)
 * 
 * ## CSS Integration
 * 
 * Theme applies class to `<html>` element:
 * - Sets theme class (e.g., `light`, `dark`)
 * - Sets `dark` class on dark themes for Tailwind `dark:` variants
 * - Persists preference in localStorage
 * 
 * ## Setup
 * 
 * ```typescript
 * function App() {
 *   return (
 *     <ThemeProvider>
 *       <YourApp />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 * 
 * ## Usage
 * 
 * ```typescript
 * function ThemeToggle() {
 *   const { theme, isDark, toggleTheme } = useTheme();
 *   return (
 *     <button onClick={toggleTheme}>
 *       Switch from {theme} to next theme
 *     </button>
 *   );
 * }
 * ```
 * 
 * @component
 * @param {Object} props - Provider props
 * @param {ReactNode} props.children - Child components
 * @returns {ReactNode} Provider wrapping children
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first using adapter
    const stored = themeStorage.read();
    if (stored) {
      return stored;
    }
    
    // Check system preference
    if (typeof window !== 'undefined') {
      const mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
      if (mediaQuery?.matches) {
        return 'dark'; // Default to neutral dark
      }
    }
    return 'light';
  });

  const toggleTheme = () => {
    const currentIndex = themeOptions.findIndex(option => option.id === theme);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % themeOptions.length : 0;
    const nextTheme = themeOptions[nextIndex]?.id ?? 'light';
    setTheme(nextTheme);
  };

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  useEffect(() => {
    const root = globalThis.document.documentElement;
    
    // Remove all theme classes including legacy ones
    const allThemeClasses = ['light', 'dark', 'paperwhite', 'sterling', 'slate', 'stone', 'zinc'];
    allThemeClasses.forEach(cls => {
      root.classList.remove(cls);
    });
    
    // Add the current theme class
    root.classList.add(theme);
    
    // Add 'dark' class for dark-mode themes (for Tailwind dark: variants)
    if (theme === 'dark' || theme === 'sterling') {
      root.classList.add('dark');
    }
    
    // Store in localStorage using adapter
    themeStorage.write(theme);
  }, [theme]);

  const isDarkTheme = theme === 'dark' || theme === 'sterling';
  const tone: ThemeTone = isDarkTheme ? 'dark' : 'light';

  return (
    <ThemeContext.Provider
      value={{
        theme,
        tone,
        isDark: isDarkTheme,
        toggleTheme,
        setTheme: handleSetTheme,
        themeOptions,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the theme context and control theming.
 * 
 * Provides access to current theme, tone, and switching capabilities.
 * Throws if used outside ThemeProvider.
 * 
 * ## Example
 * 
 * ```typescript
 * function ThemeDisplay() {
 *   const { theme, isDark, toggleTheme, setTheme } = useTheme();
 *   
 *   return (
 *     <div>
 *       <p>Current: {theme} ({isDark ? 'dark' : 'light'})</p>
 *       <button onClick={toggleTheme}>Next Theme</button>
 *       <button onClick={() => setTheme('dark')}>Dark Mode</button>
 *     </div>
 *   );
 * }
 * ```
 * 
 * ## Available Properties
 * 
 * - `theme`: Currently active theme ID
 * - `tone`: Simplified dark/light categorization
 * - `isDark`: Boolean flag for current darkness
 * - `toggleTheme()`: Cycle to next theme
 * - `setTheme(theme)`: Switch to specific theme
 * 
 * @hook
 * @returns {ThemeContextType} Theme context with state and controls
 * @throws {Error} If used outside ThemeProvider
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}