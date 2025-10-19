import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'paperwhite' | 'paper' | 'soft-dark' | 'dark';
type ThemeTone = 'light' | 'dark';

interface ThemeOption {
  id: Theme;
  name: string;
  description: string;
}

export const themeOptions: ThemeOption[] = [
  { id: 'light', name: 'Light', description: 'Clean light theme' },
  { id: 'paperwhite', name: 'Paperwhite', description: 'Crisp white e-reader theme' },
  { id: 'paper', name: 'Paper', description: 'Parchment' },
  { id: 'soft-dark', name: 'Soft Dark', description: 'Easier on the eyes dark theme' },
  { id: 'dark', name: 'Dark', description: 'High contrast dark theme' },
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
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'soft-dark'; // Default to softer dark theme
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
    
    // Remove all theme classes
    themeOptions.forEach(option => {
      root.classList.remove(option.id);
    });
    
    // Add new theme class
    root.classList.add(theme);
    
    // Store in localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const isDarkTheme = theme === 'dark' || theme === 'soft-dark';
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