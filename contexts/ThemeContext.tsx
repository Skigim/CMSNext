import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'soft-dark' | 'warm' | 'blue' | 'paper';

interface ThemeOption {
  id: Theme;
  name: string;
  description: string;
}

export const themeOptions: ThemeOption[] = [
  { id: 'light', name: 'Light', description: 'Clean light theme' },
  { id: 'dark', name: 'Dark', description: 'High contrast dark theme' },
  { id: 'soft-dark', name: 'Soft Dark', description: 'Easier on the eyes dark theme' },
  { id: 'warm', name: 'Warm', description: 'Cream and warm tones' },
  { id: 'blue', name: 'Blue', description: 'Professional blue theme' },
  { id: 'paper', name: 'Paper', description: 'Sepia paper-like theme' },
];

interface ThemeContextType {
  theme: Theme;
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
    // Cycle through the most common themes: light -> soft-dark -> light
    const newTheme = theme === 'light' ? 'soft-dark' : 'light';
    setTheme(newTheme);
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

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: handleSetTheme, themeOptions }}>
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