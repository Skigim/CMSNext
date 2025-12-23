import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'paperwhite' | 'sterling';
type ThemeTone = 'light' | 'dark';

interface ThemeOption {
  id: Theme;
  name: string;
  description: string;
}

export const themeOptions: ThemeOption[] = [
  { id: 'light', name: 'Light', description: 'Clean bright white' },
  { id: 'paperwhite', name: 'Paperwhite', description: 'Warm cream, easy on the eyes' },
  { id: 'sterling', name: 'Sterling', description: 'Soft gray, between light and dark' },
  { id: 'dark', name: 'Dark', description: 'Deep blue-gray' },
];

interface ThemeContextType {
  theme: Theme;
  tone: ThemeTone;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  themeOptions: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first, then system preference
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme;
      if (stored && themeOptions.some(opt => opt.id === stored)) {
        return stored;
      }
      
      // Check system preference
      const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
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
    const root = window.document.documentElement;
    
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
    
    // Store in localStorage
    localStorage.setItem('theme', theme);
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

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}