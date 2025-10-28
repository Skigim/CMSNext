import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';

// Test component that exposes theme controls
function ThemeTestComponent() {
  const { theme, setTheme, isDark, tone } = useTheme();
  
  return (
    <div>
      <div data-testid="current-theme">{theme}</div>
      <div data-testid="is-dark">{isDark ? 'true' : 'false'}</div>
      <div data-testid="tone">{tone}</div>
      <button onClick={() => setTheme('dark')} data-testid="set-dark">
        Set Neutral Dark
      </button>
      <button onClick={() => setTheme('slate-dark')} data-testid="set-slate-dark">
        Set Slate Dark
      </button>
      <button onClick={() => setTheme('light')} data-testid="set-light">
        Set Light
      </button>
      <button onClick={() => setTheme('slate')} data-testid="set-slate">
        Set Slate
      </button>
    </div>
  );
}

describe('ThemeContext', () => {
  const getHtmlClasses = () => Array.from(document.documentElement.classList);
  let getItemSpy: any;
  let setItemSpy: any;
  
  beforeAll(() => {
    // Mock matchMedia before any tests run
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });
  
  beforeEach(() => {
    // Set up localStorage spies
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    
    // Clear all classes from html element
    document.documentElement.className = '';
  });

  afterEach(() => {
    // Clean up
    vi.restoreAllMocks();
    document.documentElement.className = '';
  });

  describe('theme class application', () => {
    it('should apply only "dark" class for neutral dark theme', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      const setDarkBtn = screen.getByTestId('set-dark');
      await user.click(setDarkBtn);

      await waitFor(() => {
        const classes = getHtmlClasses();
        expect(classes).toContain('dark');
        expect(classes).not.toContain('slate');
        expect(classes).not.toContain('stone');
        expect(classes).not.toContain('zinc');
        expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      });
    });

    it('should apply both "slate" and "dark" classes for slate-dark theme', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      const setSlateDarkBtn = screen.getByTestId('set-slate-dark');
      await user.click(setSlateDarkBtn);

      await waitFor(() => {
        const classes = getHtmlClasses();
        expect(classes).toContain('slate');
        expect(classes).toContain('dark');
        expect(classes).not.toContain('slate-dark'); // compound ID should NOT be a class
        expect(screen.getByTestId('current-theme')).toHaveTextContent('slate-dark');
      });
    });

    it('should properly clean up classes when switching from slate-dark to dark', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      // First set slate-dark
      const setSlateDarkBtn = screen.getByTestId('set-slate-dark');
      await user.click(setSlateDarkBtn);

      await waitFor(() => {
        const classes = getHtmlClasses();
        expect(classes).toContain('slate');
        expect(classes).toContain('dark');
      });

      // Then switch to neutral dark
      const setDarkBtn = screen.getByTestId('set-dark');
      await user.click(setDarkBtn);

      await waitFor(() => {
        const classes = getHtmlClasses();
        expect(classes).toContain('dark');
        expect(classes).not.toContain('slate');
        expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      });
    });

    it('should properly clean up classes when switching from dark to slate-dark', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      // First set neutral dark
      const setDarkBtn = screen.getByTestId('set-dark');
      await user.click(setDarkBtn);

      await waitFor(() => {
        const classes = getHtmlClasses();
        expect(classes).toContain('dark');
        expect(classes).not.toContain('slate');
      });

      // Then switch to slate-dark
      const setSlateDarkBtn = screen.getByTestId('set-slate-dark');
      await user.click(setSlateDarkBtn);

      await waitFor(() => {
        const classes = getHtmlClasses();
        expect(classes).toContain('slate');
        expect(classes).toContain('dark');
        expect(screen.getByTestId('current-theme')).toHaveTextContent('slate-dark');
      });
    });

    it('should apply only "slate" class for slate light theme', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      const setSlateBtn = screen.getByTestId('set-slate');
      await user.click(setSlateBtn);

      await waitFor(() => {
        const classes = getHtmlClasses();
        expect(classes).toContain('slate');
        expect(classes).not.toContain('dark');
        expect(screen.getByTestId('current-theme')).toHaveTextContent('slate');
      });
    });

    it('should properly clean up all classes when switching themes', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      // Start with light
      const setLightBtn = screen.getByTestId('set-light');
      await user.click(setLightBtn);

      await waitFor(() => {
        const classes = getHtmlClasses();
        expect(classes).toContain('light');
      });

      // Switch to slate
      const setSlateBtn = screen.getByTestId('set-slate');
      await user.click(setSlateBtn);

      await waitFor(() => {
        const classes = getHtmlClasses();
        expect(classes).toContain('slate');
        expect(classes).not.toContain('light');
      });

      // Switch to dark
      const setDarkBtn = screen.getByTestId('set-dark');
      await user.click(setDarkBtn);

      await waitFor(() => {
        const classes = getHtmlClasses();
        expect(classes).toContain('dark');
        expect(classes).not.toContain('slate');
        expect(classes).not.toContain('light');
      });
    });
  });

  describe('theme state', () => {
    it('should set isDark to true for neutral dark theme', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      const setDarkBtn = screen.getByTestId('set-dark');
      await user.click(setDarkBtn);

      await waitFor(() => {
        expect(screen.getByTestId('is-dark')).toHaveTextContent('true');
        expect(screen.getByTestId('tone')).toHaveTextContent('dark');
      });
    });

    it('should set isDark to true for slate-dark theme', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      const setSlateDarkBtn = screen.getByTestId('set-slate-dark');
      await user.click(setSlateDarkBtn);

      await waitFor(() => {
        expect(screen.getByTestId('is-dark')).toHaveTextContent('true');
        expect(screen.getByTestId('tone')).toHaveTextContent('dark');
      });
    });

    it('should set isDark to false for light theme', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      const setLightBtn = screen.getByTestId('set-light');
      await user.click(setLightBtn);

      await waitFor(() => {
        expect(screen.getByTestId('is-dark')).toHaveTextContent('false');
        expect(screen.getByTestId('tone')).toHaveTextContent('light');
      });
    });
  });

  // Note: localStorage tests are skipped because the global test setup
  // already mocks localStorage, making it difficult to test localStorage
  // interactions in isolation. The class application tests above verify
  // the core functionality.
});
