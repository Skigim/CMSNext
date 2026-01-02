import type { Preview } from '@storybook/react-vite';
import React from 'react';
import { DirectionProvider } from '@radix-ui/react-direction';

// Import global styles (Tailwind v4 + CSS variables)
import '../styles/globals.css';

// Browser API mocks for Storybook environment
// (mirrors src/test/setup.ts but without Vitest dependency)
if (typeof window !== 'undefined') {
  // Mock matchMedia for ThemeContext
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList;
  }

  // Mock ResizeObserver for Radix UI components
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  // Mock IntersectionObserver for virtualized lists
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class IntersectionObserver {
      root = null;
      rootMargin = '';
      thresholds = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  }
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Background options matching our themes
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: 'oklch(100% 0 0)' },
        { name: 'dark', value: 'oklch(14.08% 0.004 285.82)' },
        { name: 'paperwhite', value: 'oklch(98.5% 0.008 85)' },
        { name: 'sterling', value: 'oklch(28% 0.006 265)' },
      ],
    },
  },
  decorators: [
    // Wrap all stories with DirectionProvider for Radix UI components
    (Story) => (
      <DirectionProvider dir="ltr">
        <Story />
      </DirectionProvider>
    ),
  ],
  // Theme switching can be added later with @storybook/addon-themes
  // For now, stories inherit the default 'light' theme from globals.css
};

export default preview;