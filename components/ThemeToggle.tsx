import { Moon, Sun, Palette, Check } from 'lucide-react';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { useTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme, setTheme, themeOptions } = useTheme();

  const getThemeIcon = (themeId: string) => {
    switch (themeId) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
      case 'soft-dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Palette className="h-4 w-4" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
        >
          {getThemeIcon(theme)}
          <span className="sr-only">Open theme menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {themeOptions.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => setTheme(option.id)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              {getThemeIcon(option.id)}
              <div className="flex flex-col">
                <span className="text-sm font-medium">{option.name}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </div>
            {theme === option.id && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={toggleTheme}
          className="flex items-center gap-2"
        >
          <div className="flex h-4 w-4 items-center justify-center">
            {theme === 'light' ? (
              <Moon className="h-3 w-3" />
            ) : (
              <Sun className="h-3 w-3" />
            )}
          </div>
          <span className="text-sm">Quick toggle</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}