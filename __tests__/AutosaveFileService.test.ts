import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import AutosaveFileService from '@/utils/AutosaveFileService'

// Mock File System Access API
const mockShowDirectoryPicker = vi.fn()
const mockDirectoryHandle = {
  name: 'test-directory',
  kind: 'directory',
  queryPermission: vi.fn(),
  requestPermission: vi.fn(),
  getFileHandle: vi.fn(),
  entries: vi.fn()
}

// Global mocks setup
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks()

  // Mock window.showDirectoryPicker
  Object.defineProperty(global, 'window', {
    value: {
      showDirectoryPicker: mockShowDirectoryPicker
    },
    writable: true
  })

  // Mock navigator
  Object.defineProperty(global, 'navigator', {
    value: {
      storage: {
        persist: vi.fn().mockResolvedValue(true)
      }
    },
    writable: true
  })

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  }
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true
  })

  // Mock indexedDB
  Object.defineProperty(global, 'indexedDB', {
    value: {
      open: vi.fn().mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: {
          objectStoreNames: { contains: vi.fn().mockReturnValue(true) },
          createObjectStore: vi.fn(),
          transaction: vi.fn().mockReturnValue({
            objectStore: vi.fn().mockReturnValue({
              get: vi.fn().mockReturnValue({ 
                onsuccess: null,
                onerror: null,
                result: null
              }),
              put: vi.fn().mockReturnValue({ 
                onsuccess: null,
                onerror: null
              }),
              delete: vi.fn().mockReturnValue({ 
                onsuccess: null,
                onerror: null
              })
            })
          })
        }
      }))
    },
    writable: true
  })

  // Mock console methods to reduce test noise
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  // Setup mock behaviors
  mockDirectoryHandle.queryPermission.mockResolvedValue('granted')
  mockDirectoryHandle.requestPermission.mockResolvedValue('granted')
  mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AutosaveFileService', () => {
  let service: AutosaveFileService
  let mockErrorCallback: ReturnType<typeof vi.fn>
  let mockStatusCallback: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockErrorCallback = vi.fn()
    mockStatusCallback = vi.fn()
    
    service = new AutosaveFileService({
      fileName: 'test-data.json',
      errorCallback: mockErrorCallback,
      statusCallback: mockStatusCallback,
      enabled: false // Disable autosave for testing
    })
  })

  afterEach(() => {
    if (service) {
      service.destroy()
    }
  })

  describe('browser support and initialization', () => {
    it('should check if File System Access API is supported', () => {
      expect(service.isSupported()).toBe(true)
      
      // Test unsupported scenario
      delete (global.window as any).showDirectoryPicker
      expect(service.isSupported()).toBe(false)
    })

    it('should initialize with default configuration', () => {
      const defaultService = new AutosaveFileService({})
      
      expect(defaultService.isSupported()).toBe(true)
      expect(defaultService.getStatus()).toMatchObject({
        isRunning: expect.any(Boolean),
        permissionStatus: expect.any(String),
        lastSaveTime: null,
        consecutiveFailures: expect.any(Number)
      })
      
      defaultService.destroy()
    })

    it('should handle missing navigator.storage gracefully', () => {
      Object.defineProperty(global.navigator, 'storage', {
        value: undefined,
        writable: true
      })
      
      const service2 = new AutosaveFileService({ enabled: false })
      expect(service2.isSupported()).toBe(true) // Should still work
      service2.destroy()
    })
  })

  describe('service status and configuration', () => {
    it('should get service status', () => {
      const status = service.getStatus()
      
      expect(status).toMatchObject({
        isRunning: expect.any(Boolean),
        permissionStatus: expect.any(String),
        lastSaveTime: null,
        lastDataChange: null,
        consecutiveFailures: expect.any(Number),
        pendingSave: expect.any(Boolean),
        isSupported: true
      })
    })

    it('should update configuration', () => {
      expect(() => {
        service.updateConfig({
          enabled: true,
          saveInterval: 10000,
          debounceDelay: 2000,
          maxRetries: 5
        })
      }).not.toThrow()
    })

    it('should set data load callback', () => {
      const callback = vi.fn()
      expect(() => {
        service.setDataLoadCallback(callback)
      }).not.toThrow()
    })
  })

  describe('error handling and edge cases', () => {
    it('should handle unsupported browser for connect', async () => {
      delete (global.window as any).showDirectoryPicker
      
      const result = await service.connect()
      
      expect(result).toBe(false)
      expect(mockErrorCallback).toHaveBeenCalledWith(
        'File System Access API is not supported in this browser.',
        'error',
        null,
        expect.objectContaining({ operation: 'connect' })
      )
    })

    it('should handle connection cancellation (AbortError)', async () => {
      const abortError = new Error('User cancelled')
      abortError.name = 'AbortError'
      mockShowDirectoryPicker.mockRejectedValue(abortError)
      
      const result = await service.connect()
      
      expect(result).toBe(false)
      expect(mockErrorCallback).not.toHaveBeenCalled() // Should not call error callback for AbortError
    })

    it('should handle connection errors', async () => {
      mockShowDirectoryPicker.mockRejectedValue(new Error('Permission denied'))
      
      const result = await service.connect()
      
      expect(result).toBe(false)
    })

    it('should handle permission denial', async () => {
      mockDirectoryHandle.requestPermission.mockResolvedValue('denied')
      
      const result = await service.connect()
      
      expect(result).toBe(false)
      expect(mockErrorCallback).toHaveBeenCalledWith(
        'Permission denied for the directory.',
        'error',
        null,
        expect.objectContaining({ operation: 'requestPermission' })
      )
    })

    it('should return prompt when no directory handle for permission check', async () => {
      const permission = await service.checkPermission()
      expect(permission).toBe('prompt')
    })

    it('should handle connectToExisting with unsupported browser', async () => {
      delete (global.window as any).showDirectoryPicker
      
      const result = await service.connectToExisting()
      expect(result).toBe(false)
      expect(mockErrorCallback).toHaveBeenCalledWith(
        'File System Access API is not supported in this browser.',
        'error',
        null,
        expect.objectContaining({ operation: 'connectExisting' })
      )
    })

    it('should handle operations without directory handle', async () => {
      const writeResult = await service.writeFile({ test: 'data' })
      expect(writeResult).toBe(false)
      
      const readResult = await service.readFile()
      expect(readResult).toBe(null)
      
      const files = await service.listDataFiles()
      expect(files).toEqual([])
    })

    it('should handle destroyed service gracefully', () => {
      service.destroy()
      
      expect(() => service.getStatus()).not.toThrow()
      expect(() => service.updateConfig({ enabled: true })).not.toThrow()
    })
  })

  describe('configuration variations', () => {
    it('should accept custom configuration', () => {
      const customService = new AutosaveFileService({
        fileName: 'custom.json',
        errorCallback: mockErrorCallback,
        statusCallback: mockStatusCallback,
        enabled: true,
        debounceDelay: 500,
        saveInterval: 30000,
        maxRetries: 3
      })
      
      expect(customService.getStatus().isSupported).toBe(true)
      customService.destroy()
    })

    it('should handle minimal configuration', () => {
      const minimalService = new AutosaveFileService({})
      
      expect(() => minimalService.isSupported()).not.toThrow()
      expect(minimalService.getStatus()).toMatchObject({
        isSupported: expect.any(Boolean)
      })
      
      minimalService.destroy()
    })

    it('should handle configuration with only callbacks', () => {
      const callbackService = new AutosaveFileService({
        errorCallback: mockErrorCallback,
        statusCallback: mockStatusCallback
      })
      
      expect(callbackService.getStatus().isSupported).toBe(true)
      callbackService.destroy()
    })
  })

  describe('async operation error handling', () => {
    it('should handle connect timeout gracefully', async () => {
      // Mock a slow response that would timeout
      mockShowDirectoryPicker.mockImplementation(() => new Promise(() => {})) // Never resolves
      
      // Start connect but don't wait for it to complete
      const connectPromise = service.connect()
      
      // Destroy service while connect is pending
      service.destroy()
      
      // The connect should handle destruction gracefully
      const result = await Promise.race([
        connectPromise,
        new Promise(resolve => setTimeout(() => resolve(false), 100))
      ])
      
      expect(result).toBe(false)
    })
  })

  describe('resilience behaviours', () => {
    it('surfaces permission loss during write attempts', async () => {
      mockStatusCallback.mockClear()
      ;(service as any).directoryHandle = mockDirectoryHandle
      mockDirectoryHandle.queryPermission.mockResolvedValueOnce('denied')

      const result = await service.writeFile({ sample: 'data' })

      expect(result).toBe(false)
      expect(mockStatusCallback.mock.calls.some(call => call[0].status === 'waiting')).toBe(true)
  const latestCall = mockStatusCallback.mock.calls[mockStatusCallback.mock.calls.length - 1]
  const latestStatus = latestCall ? latestCall[0] : null
      expect(latestStatus?.permissionStatus).toBe('denied')
    })

    it('emits retrying then error after repeated autosave failures', async () => {
      mockStatusCallback.mockClear()
      ;(service as any).state.isRunning = true
      ;(service as any).dataProvider = () => ({ cases: [] })
      ;(service as any).config.maxRetries = 2

      const writeSpy = vi
        .spyOn(service as any, 'writeFile')
        .mockResolvedValue(false)

      await (service as any).performAutosave('interval')

      expect(
        mockStatusCallback.mock.calls.some(call => call[0].status === 'retrying'),
      ).toBe(true)
      expect((service as any).state.consecutiveFailures).toBe(1)

      mockStatusCallback.mockClear()

      await (service as any).performAutosave('interval')

      expect(
        mockStatusCallback.mock.calls.some(call => call[0].status === 'error'),
      ).toBe(true)
      expect((service as any).state.consecutiveFailures).toBe(2)

      writeSpy.mockRestore()
    })
  })

  describe('service lifecycle', () => {
    it('should destroy properly', () => {
      service.destroy()
      
      // Should be able to call methods without errors after destroy
      expect(() => service.getStatus()).not.toThrow()
      expect(() => service.destroy()).not.toThrow() // Multiple destroys should be safe
    })

    it('should handle configuration updates without connection', () => {
      expect(() => {
        service.updateConfig({
          enabled: true,
          saveInterval: 5000
        })
      }).not.toThrow()
    })
  })
})