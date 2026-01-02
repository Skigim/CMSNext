/**
 * Storybook decorators using real context interfaces.
 *
 * Following testing guidelines: uses actual context providers with default/stub values
 * rather than parallel mock implementations that can drift from production behavior.
 *
 * @see src/test/reactTestUtils.tsx for the same pattern used in tests
 */
import React, { type ReactNode, useMemo } from 'react';
import { DirectionProvider } from '@radix-ui/react-direction';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { EncryptionProvider } from '../../contexts/EncryptionContext';
import { CategoryConfigContext } from '../../contexts/CategoryConfigContext';
import { mergeCategoryConfig, type PartialCategoryConfigInput } from '../../types/categoryConfig';

// ============================================================================
// CategoryConfig Provider (matches test pattern from reactTestUtils.tsx)
// ============================================================================

/**
 * Creates a CategoryConfigContext value for Storybook stories.
 * Uses real mergeCategoryConfig() to ensure type safety and consistency.
 */
function createStorybookCategoryConfigValue(configOverrides?: PartialCategoryConfigInput) {
  return {
    config: mergeCategoryConfig(configOverrides),
    loading: false,
    error: null,
    refresh: async () => {
      console.log('[Storybook] CategoryConfig.refresh called');
    },
    updateCategory: async () => {
      console.log('[Storybook] CategoryConfig.updateCategory called');
    },
    resetToDefaults: async () => {
      console.log('[Storybook] CategoryConfig.resetToDefaults called');
    },
    setConfigFromFile: () => {
      console.log('[Storybook] CategoryConfig.setConfigFromFile called');
    },
  };
}

/**
 * CategoryConfig provider for Storybook that bypasses DataManager dependency.
 * Directly provides context value using real interfaces.
 */
function StorybookCategoryConfigProvider({
  children,
  config,
}: {
  children: ReactNode;
  config?: PartialCategoryConfigInput;
}) {
  const value = useMemo(() => createStorybookCategoryConfigValue(config), [config]);
  return (
    <CategoryConfigContext.Provider value={value}>
      {children}
    </CategoryConfigContext.Provider>
  );
}

// ============================================================================
// Combined Provider for Stories
// ============================================================================

/**
 * Combined provider that wraps stories with real context providers.
 *
 * Uses actual ThemeProvider, EncryptionProvider, and CategoryConfigContext
 * with default values. Does NOT include FileStorageProvider or DataManagerProvider
 * since those require browser File System Access API.
 *
 * For components that require DataManager, use story-level mocks via msw or
 * inject mock data through props.
 *
 * @example
 * ```tsx
 * export const MyStory: Story = {
 *   decorators: [
 *     (Story) => (
 *       <StorybookProviders>
 *         <Story />
 *       </StorybookProviders>
 *     ),
 *   ],
 * };
 * ```
 */
export function StorybookProviders({
  children,
  categoryConfig,
}: {
  children: ReactNode;
  categoryConfig?: PartialCategoryConfigInput;
}) {
  return (
    <DirectionProvider dir="ltr">
      <ThemeProvider>
        <EncryptionProvider>
          <StorybookCategoryConfigProvider config={categoryConfig}>
            {children}
          </StorybookCategoryConfigProvider>
        </EncryptionProvider>
      </ThemeProvider>
    </DirectionProvider>
  );
}

// Re-export for backwards compatibility and explicit naming
export { StorybookCategoryConfigProvider };

// Export the value factory for stories that need direct context control
export { createStorybookCategoryConfigValue };
