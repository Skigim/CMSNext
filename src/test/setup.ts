import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock matchMedia for ThemeContext
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock File System Access API since it's not available in test environment
const mockFileSystemAccessAPI = {
  showDirectoryPicker: vi.fn(),
  showOpenFilePicker: vi.fn(),
  showSaveFilePicker: vi.fn(),
}

Object.defineProperty(window, 'showDirectoryPicker', {
  value: mockFileSystemAccessAPI.showDirectoryPicker,
  writable: true,
})

Object.defineProperty(window, 'showOpenFilePicker', {
  value: mockFileSystemAccessAPI.showOpenFilePicker,
  writable: true,
})

Object.defineProperty(window, 'showSaveFilePicker', {
  value: mockFileSystemAccessAPI.showSaveFilePicker,
  writable: true,
})

// Mock navigator.userAgent for browser detection tests
Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Chrome Test Environment)',
  writable: true,
})

// Mock localStorage 
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock URL.createObjectURL and URL.revokeObjectURL for file operations
Object.defineProperty(URL, 'createObjectURL', {
  value: vi.fn(() => 'mocked-object-url'),
  writable: true,
})

Object.defineProperty(URL, 'revokeObjectURL', {
  value: vi.fn(),
  writable: true,
})

// Mock ResizeObserver for components that use it
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver 
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Extend expect with custom matchers if needed
expect.extend({
  // Add custom matchers here if needed
})

// Global test utilities
export const testUtils = {
  mockFileSystemAccessAPI,
  localStorageMock,
}