import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { EncryptionProvider } from '@/contexts/EncryptionContext'
import { CategoryConfigContext } from '@/contexts/CategoryConfigContext'
import { createMockDataManager, createMockDirectoryHandle, createMockCategoryConfigValue } from './testUtils'
import type { PartialCategoryConfigInput } from '@/types/categoryConfig'

/**
 * Test-specific CategoryConfigProvider that uses injected config
 * This bypasses the DataManager dependency for component tests by
 * directly providing the context value
 */
const TestCategoryConfigProvider: React.FC<{
  children: React.ReactNode
  config?: PartialCategoryConfigInput
}> = ({ children, config }) => {
  const value = React.useMemo(() => createMockCategoryConfigValue(config), [config])
  return (
    <CategoryConfigContext.Provider value={value}>
      {children}
    </CategoryConfigContext.Provider>
  )
}

/**
 * Custom render function that includes providers needed for testing
 */

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Whether to mock the file system context (default: true)
   */
  mockFileSystem?: boolean
  /**
   * Mock DataManager instance - use createMockDataManager() from testUtils
   */
  mockDataManager?: ReturnType<typeof createMockDataManager>
  /**
   * Category config to inject into CategoryConfigContext
   * Bypasses DataManager dependency for simpler component tests
   */
  categoryConfig?: PartialCategoryConfigInput
}

const AllTheProviders = ({ 
  children, 
  mockFileSystem = true,
  mockDataManager,
  categoryConfig
}: { 
  children: React.ReactNode 
  mockFileSystem?: boolean
  mockDataManager?: ReturnType<typeof createMockDataManager>
  categoryConfig?: PartialCategoryConfigInput
}) => {
  // Mock file system context if requested
  if (mockFileSystem) {
    createMockDirectoryHandle()
    
    // Mock DataManagerContext if provided
    if (mockDataManager) {
      // This would be where we inject the mock data manager
      // For now, we'll use the AppProviders as-is
    }
  }

  // Use test-specific provider hierarchy that doesn't require DataManager
  return (
    <ThemeProvider>
      <EncryptionProvider>
        <TestCategoryConfigProvider config={categoryConfig}>
          {children}
        </TestCategoryConfigProvider>
      </EncryptionProvider>
    </ThemeProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { 
    mockFileSystem, 
    mockDataManager,
    categoryConfig,
    ...renderOptions 
  } = options

  return render(ui, {
    wrapper: (props) => AllTheProviders({ 
      ...props, 
      mockFileSystem,
      mockDataManager,
      categoryConfig
    }),
    ...renderOptions,
  })
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Import screen from testing library for convenience
export { screen } from '@testing-library/react'