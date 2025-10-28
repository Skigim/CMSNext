import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'slate' | 'slate-dark' | 'stone' | 'stone-dark' | 'zinc' | 'zinc-dark';
type ThemeTone = 'light' | 'dark';

interface ThemeOption {
  id: Theme;
  name: string;
  description: string;
  family: 'neutral' | 'slate' | 'stone' | 'zinc';
}

export const themeOptions: ThemeOption[] = [
  { id: 'light', name: 'Neutral Light', description: 'Clean pure grayscale', family: 'neutral' },
  { id: 'dark', name: 'Neutral Dark', description: 'Pure dark grayscale', family: 'neutral' },
  { id: 'slate', name: 'Slate Light', description: 'Sophisticated purple-gray', family: 'slate' },
  { id: 'slate-dark', name: 'Slate Dark', description: 'Purple-gray dark mode', family: 'slate' },
  { id: 'stone', name: 'Stone Light', description: 'Warm earthy brown-gray', family: 'stone' },
  { id: 'stone-dark', name: 'Stone Dark', description: 'Warm dark mode', family: 'stone' },
  { id: 'zinc', name: 'Zinc Light', description: 'Modern cool blue-gray', family: 'zinc' },
  { id: 'zinc-dark', name: 'Zinc Dark', description: 'Cool dark mode', family: 'zinc' },
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
    
    // Remove all theme classes
    themeOptions.forEach(option => {
      root.classList.remove(option.id);
    });
    
    // For compound themes like 'slate-dark', we need to add both 'slate' and 'dark' classes
    if (theme.includes('-dark')) {
      const baseTheme = theme.replace('-dark', '');
      root.classList.add(baseTheme, 'dark');
    } else {
      root.classList.add(theme);
    }
    
    // Store in localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const isDarkTheme = theme.includes('-dark') || theme === 'dark';
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