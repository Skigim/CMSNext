import React, { ReactElement } from 'react'
import { render, RenderOptions, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProviders } from '../../components/providers/AppProviders'
import { createMockDataManager, createMockDirectoryHandle } from './testUtils'

/**
 * Custom render function that includes all the providers
 */

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add custom options here if needed
  mockFileSystem?: boolean
  mockDataManager?: ReturnType<typeof createMockDataManager>
}

const AllTheProviders = ({ 
  children, 
  mockFileSystem = true,
  mockDataManager
}: { 
  children: React.ReactNode 
  mockFileSystem?: boolean
  mockDataManager?: ReturnType<typeof createMockDataManager>
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

  return (
    <AppProviders>
      {children}
    </AppProviders>
  )
}

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { 
    mockFileSystem, 
    mockDataManager,
    ...renderOptions 
  } = options

  return render(ui, {
    wrapper: (props) => AllTheProviders({ 
      ...props, 
      mockFileSystem,
      mockDataManager 
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