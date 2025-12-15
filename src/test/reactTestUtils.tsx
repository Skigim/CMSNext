import React, { ReactElement } from 'react'
import { render, RenderOptions, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

/**
 * Helper functions for common testing scenarios
 */

export const renderWithFileSystem = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  return customRender(ui, {
    mockFileSystem: true,
    ...options
  })
}

export const renderWithMockData = (
  ui: ReactElement,
  mockDataManager: ReturnType<typeof createMockDataManager>,
  options: CustomRenderOptions = {}
) => {
  return customRender(ui, {
    mockFileSystem: true,
    mockDataManager,
    ...options
  })
}

/**
 * Render with specific category config for testing components that use useCategoryConfig
 */
export const renderWithCategoryConfig = (
  ui: ReactElement,
  categoryConfig: PartialCategoryConfigInput,
  options: CustomRenderOptions = {}
) => {
  return customRender(ui, {
    categoryConfig,
    ...options
  })
}

/**
 * Common test utilities for user interactions
 */

export const userInteractions = {
  clickButton: async (buttonText: string) => {
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: buttonText })
    await user.click(button)
    return button
  },
  
  fillInput: async (labelText: string, value: string) => {
    const user = userEvent.setup()
    const input = screen.getByLabelText(labelText)
    await user.clear(input)
    await user.type(input, value)
    return input
  },
  
  selectOption: async (selectLabelText: string, optionText: string) => {
    const user = userEvent.setup()
    const select = screen.getByLabelText(selectLabelText)
    await user.click(select)
    const option = screen.getByRole('option', { name: optionText })
    await user.click(option)
    return { select, option }
  },
  
  openModal: async (triggerText: string) => {
    const user = userEvent.setup()
    const trigger = screen.getByRole('button', { name: triggerText })
    await user.click(trigger)
    // Wait for modal to appear
    await screen.findByRole('dialog')
    return trigger
  }
}

// Import screen from testing library for convenience
export { screen } from '@testing-library/react'