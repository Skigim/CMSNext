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

function prepareForEncryptionCheck(svc: AutosaveFileService) {
  (svc as any).directoryHandle = mockDirectoryHandle;
  vi.spyOn(svc, 'checkPermission').mockResolvedValue('granted');
}

// Global mocks setup
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks()

  // Mock window.showDirectoryPicker
  Object.defineProperty(globalThis, 'window', {
    value: {
      showDirectoryPicker: mockShowDirectoryPicker
    },
    writable: true
  })

  Object.defineProperty(globalThis, 'showDirectoryPicker', {
    value: mockShowDirectoryPicker,
    writable: true,
    configurable: true,
  })

  // Mock navigator
  Object.defineProperty(globalThis, 'navigator', {
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
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true
  })

  // Mock indexedDB
  Object.defineProperty(globalThis, 'indexedDB', {
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
    it('should return true when File System Access API is supported', () => {
      // ARRANGE

      // ACT
      const isSupported = service.isSupported()

      // ASSERT
      expect(isSupported).toBe(true)
    })

    it('should return false when File System Access API is not supported', () => {
      // ARRANGE
      delete (globalThis as any).showDirectoryPicker

      // ACT
      const isSupported = service.isSupported()

      // ASSERT
      expect(isSupported).toBe(false)
    })

    it('should initialize with default configuration', () => {
      // ARRANGE
      const defaultService = new AutosaveFileService({})
      
      // ACT
      const status = defaultService.getStatus()

      // ASSERT
      expect(defaultService.isSupported()).toBe(true)
      expect(status).toMatchObject({
        isRunning: expect.any(Boolean),
        permissionStatus: expect.any(String),
        lastSaveTime: null,
        consecutiveFailures: expect.any(Number)
      })
      
      defaultService.destroy()
    })

    it('should handle missing navigator.storage gracefully', () => {
      // ARRANGE
      Object.defineProperty(globalThis.navigator, 'storage', {
        value: undefined,
        writable: true
      })
      
      // ACT
      const service2 = new AutosaveFileService({ enabled: false })

      // ASSERT
      expect(service2.isSupported()).toBe(true) // Should still work
      service2.destroy()
    })
  })

  describe('service status and configuration', () => {
    it('should get service status', () => {
      // ARRANGE

      // ACT
      const status = service.getStatus()
      
      // ASSERT
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
      // ARRANGE
      const nextConfig = {
        enabled: true,
        saveInterval: 10000,
        debounceDelay: 2000,
        maxRetries: 5
      }

      // ACT & ASSERT
      expect(() => {
        service.updateConfig(nextConfig)
      }).not.toThrow()
    })

    it('should set data load callback', () => {
      // ARRANGE
      const callback = vi.fn()

      // ACT & ASSERT
      expect(() => {
        service.setDataLoadCallback(callback)
      }).not.toThrow()
    })
  })

  describe('error handling and edge cases', () => {
    it('should handle unsupported browser for connect', async () => {
      // ARRANGE
      delete (globalThis as any).showDirectoryPicker
      
      // ACT
      const result = await service.connect()
      
      // ASSERT
      expect(result).toBe(false)
      expect(mockErrorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'File System Access API is not supported in this browser.',
          type: 'error',
          context: expect.objectContaining({ operation: 'connect' })
        })
      )
    })

    it('should handle connection cancellation (AbortError)', async () => {
      // ARRANGE
      const abortError = new Error('User cancelled')
      abortError.name = 'AbortError'
      mockShowDirectoryPicker.mockRejectedValue(abortError)
      
      // ACT
      const result = await service.connect()
      
      // ASSERT
      expect(result).toBe(false)
      expect(mockErrorCallback).not.toHaveBeenCalled() // Should not call error callback for AbortError
    })

    it('should handle connection errors', async () => {
      // ARRANGE
      mockShowDirectoryPicker.mockRejectedValue(new Error('Permission denied'))
      
      // ACT
      const result = await service.connect()
      
      // ASSERT
      expect(result).toBe(false)
    })

    it('should handle permission denial', async () => {
      // ARRANGE
      mockDirectoryHandle.requestPermission.mockResolvedValue('denied')
      
      // ACT
      const result = await service.connect()
      
      // ASSERT
      expect(result).toBe(false)
      expect(mockErrorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Permission denied for the directory.',
          type: 'error',
          context: expect.objectContaining({ operation: 'requestPermission' })
        })
      )
    })

    it('should return prompt when no directory handle for permission check', async () => {
      // ARRANGE

      // ACT
      const permission = await service.checkPermission()

      // ASSERT
      expect(permission).toBe('prompt')
    })

    it('should handle connectToExisting with unsupported browser', async () => {
      // ARRANGE
      delete (globalThis as any).showDirectoryPicker
      
      // ACT
      const result = await service.connectToExisting()

      // ASSERT
      expect(result).toBe(false)
      expect(mockErrorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'File System Access API is not supported in this browser.',
          type: 'error',
          context: expect.objectContaining({ operation: 'connectExisting' })
        })
      )
    })

    it('should handle operations without directory handle', async () => {
      // ARRANGE

      // ACT
      const writeResult = await service.writeFile({ test: 'data' })
      const readResult = await service.readFile()
      const files = await service.listDataFiles()

      // ASSERT
      expect(writeResult).toBe(false)
      expect(readResult).toBe(null)
      expect(files).toEqual([])
    })

    it('should handle destroyed service gracefully', () => {
      // ARRANGE
      service.destroy()
      
      // ACT & ASSERT
      expect(() => service.getStatus()).not.toThrow()
      expect(() => service.updateConfig({ enabled: true })).not.toThrow()
    })
  })

  describe('configuration variations', () => {
    it('should accept custom configuration', () => {
      // ARRANGE
      const customService = new AutosaveFileService({
        fileName: 'custom.json',
        errorCallback: mockErrorCallback,
        statusCallback: mockStatusCallback,
        enabled: true,
        debounceDelay: 500,
        saveInterval: 30000,
        maxRetries: 3
      })
      
      // ACT
      const status = customService.getStatus()

      // ASSERT
      expect(status.isSupported).toBe(true)
      customService.destroy()
    })

    it('should handle minimal configuration', () => {
      // ARRANGE
      const minimalService = new AutosaveFileService({})
      
      // ACT & ASSERT
      expect(() => minimalService.isSupported()).not.toThrow()
      expect(minimalService.getStatus()).toMatchObject({
        isSupported: expect.any(Boolean)
      })
      
      minimalService.destroy()
    })

    it('should handle configuration with only callbacks', () => {
      // ARRANGE
      const callbackService = new AutosaveFileService({
        errorCallback: mockErrorCallback,
        statusCallback: mockStatusCallback
      })
      
      // ACT
      const status = callbackService.getStatus()

      // ASSERT
      expect(status.isSupported).toBe(true)
      callbackService.destroy()
    })
  })

  describe('async operation error handling', () => {
    it('should handle connect timeout gracefully', async () => {
      // ARRANGE
      // Mock a slow response that would timeout
      mockShowDirectoryPicker.mockImplementation(() => new Promise(() => {})) // Never resolves
      
      // ACT
      // Start connect but don't wait for it to complete
      const connectPromise = service.connect()
      
      // Destroy service while connect is pending
      service.destroy()
      
      // The connect should handle destruction gracefully
      const result = await Promise.race([
        connectPromise,
        new Promise(resolve => setTimeout(() => resolve(false), 100))
      ])
      
      // ASSERT
      expect(result).toBe(false)
    })
  })

  describe('resilience behaviours', () => {
    it('surfaces permission loss during write attempts', async () => {
      // ARRANGE
      mockStatusCallback.mockClear()
      ;(service as any).directoryHandle = mockDirectoryHandle
      mockDirectoryHandle.queryPermission.mockResolvedValueOnce('denied')

      // ACT
      const result = await service.writeFile({ sample: 'data' })

      // ASSERT
      expect(result).toBe(false)
      expect(mockStatusCallback.mock.calls.some(call => call[0].status === 'waiting')).toBe(true)
      const latestCall = mockStatusCallback.mock.calls[mockStatusCallback.mock.calls.length - 1]
      const latestStatus = latestCall ? latestCall[0] : null
      expect(latestStatus?.permissionStatus).toBe('denied')
    })

    it('emits retrying then error after repeated autosave failures', async () => {
      // ARRANGE
      mockStatusCallback.mockClear()
      ;(service as any).state.isRunning = true
      ;(service as any).dataProvider = () => ({ cases: [] })
      ;(service as any).config.maxRetries = 2

      const writeSpy = vi
        .spyOn(service as any, 'writeFile')
        .mockResolvedValue(false)

      // ACT
      await (service as any).performAutosave('interval')

      // ASSERT
      expect(
        mockStatusCallback.mock.calls.some(call => call[0].status === 'retrying'),
      ).toBe(true)
      expect((service as any).state.consecutiveFailures).toBe(1)

      // ARRANGE (second scenario)
      mockStatusCallback.mockClear()

      // ACT
      await (service as any).performAutosave('interval')

      // ASSERT
      expect(
        mockStatusCallback.mock.calls.some(call => call[0].status === 'error'),
      ).toBe(true)
      expect((service as any).state.consecutiveFailures).toBe(2)

      writeSpy.mockRestore()
    })

    it('retries transient primary file read failures after permission checks pass', async () => {
      // ARRANGE
      vi.useFakeTimers()
      const primaryFileService = new AutosaveFileService({
        errorCallback: mockErrorCallback,
        enabled: false,
      })
      try {
        ;(primaryFileService as any).directoryHandle = mockDirectoryHandle
        vi.spyOn(primaryFileService, 'checkPermission').mockResolvedValue('granted')

        const notReadableError = new Error('The file is temporarily unavailable')
        notReadableError.name = 'NotReadableError'

        const mockFile = {
          text: vi.fn().mockResolvedValue(JSON.stringify({ cases: [] })),
        }
        const mockFileHandle = {
          getFile: vi.fn()
            .mockRejectedValueOnce(notReadableError)
            .mockResolvedValueOnce(mockFile),
        }

        mockDirectoryHandle.getFileHandle.mockResolvedValue(mockFileHandle)

        // ACT
        const readPromise = primaryFileService.readFile()
        await vi.advanceTimersByTimeAsync(200)
        const result = await readPromise

        // ASSERT
        expect(result).toEqual({ cases: [] })
        expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('case-tracker-data.json')
        expect(mockFileHandle.getFile).toHaveBeenCalledTimes(2)
        expect(mockErrorCallback).not.toHaveBeenCalled()
      } finally {
        primaryFileService.destroy()
        vi.useRealTimers()
      }
    })
  })

  describe('service lifecycle', () => {
    it('should destroy properly', () => {
      // ARRANGE
      service.destroy()
      
      // ACT & ASSERT
      expect(() => service.getStatus()).not.toThrow()
      expect(() => service.destroy()).not.toThrow() // Multiple destroys should be safe
    })

    it('should handle configuration updates without connection', () => {
      // ARRANGE
      const nextConfig = {
        enabled: true,
        saveInterval: 5000
      }

      // ACT & ASSERT
      expect(() => {
        service.updateConfig(nextConfig)
      }).not.toThrow()
    })
  })

  describe('broadcastDataUpdate', () => {
    it('should call dataLoadCallback with provided data', () => {
      // ARRANGE
      const callback = vi.fn()
      service.setDataLoadCallback(callback)
      
      const testData = { cases: [] }

      // ACT
      service.broadcastDataUpdate(testData)
      
      // ASSERT
      expect(callback).toHaveBeenCalledWith(testData)
    })

    it('should do nothing if no callback is set', () => {
      // ARRANGE
      const testData = { cases: [] }

      // ACT & ASSERT
      expect(() => {
        service.broadcastDataUpdate(testData)
      }).not.toThrow()
    })
  })

  describe('checkFileEncryptionStatus', () => {
    it('should return null when no directory handle is set', async () => {
      // ARRANGE

      // ACT
      const result = await service.checkFileEncryptionStatus()

      // ASSERT
      expect(result).toBeNull()
    })

    it('should detect encrypted files without encryption hooks set', async () => {
      // ARRANGE
      prepareForEncryptionCheck(service)

      // Mock reading an encrypted file (EncryptedPayload shape)
      const encryptedPayload = JSON.stringify({
        version: 1,
        algorithm: 'AES-256-GCM',
        salt: 'dGVzdHNhbHQ=',
        iv: 'dGVzdGl2',
        ciphertext: 'ZW5jcnlwdGVkZGF0YQ==',
        iterations: 600000,
        encryptedAt: '2026-01-01T00:00:00.000Z',
      })

      const mockFile = { text: vi.fn().mockResolvedValue(encryptedPayload) }
      const mockFileHandle = { getFile: vi.fn().mockResolvedValue(mockFile) }
      mockDirectoryHandle.getFileHandle.mockResolvedValue(mockFileHandle)

      // No encryption hooks set (pre-auth scenario — the vulnerability)
      service.setEncryptionHooks(null)

      // ACT
      const result = await service.checkFileEncryptionStatus()

      // ASSERT
      expect(result).toEqual({ exists: true, encrypted: true })
    })

    it('should detect unencrypted files correctly', async () => {
      // ARRANGE
      prepareForEncryptionCheck(service)

      const normalData = JSON.stringify({
        cases: [],
        financials: [],
        notes: [],
      })

      const mockFile = { text: vi.fn().mockResolvedValue(normalData) }
      const mockFileHandle = { getFile: vi.fn().mockResolvedValue(mockFile) }
      mockDirectoryHandle.getFileHandle.mockResolvedValue(mockFileHandle)

      service.setEncryptionHooks(null)

      // ACT
      const result = await service.checkFileEncryptionStatus()

      // ASSERT
      expect(result).toEqual({ exists: true, encrypted: false })
    })

    it('should return exists:false when file not found', async () => {
      // ARRANGE
      prepareForEncryptionCheck(service)

      const notFoundError = new Error('File not found')
      notFoundError.name = 'NotFoundError'
      mockDirectoryHandle.getFileHandle.mockRejectedValue(notFoundError)

      // ACT
      const result = await service.checkFileEncryptionStatus()

      // ASSERT
      expect(result).toEqual({ exists: false, encrypted: false })
    })

    it('should detect encrypted files using hooks as secondary check', async () => {
      // ARRANGE
      prepareForEncryptionCheck(service)

      // Custom encryption format that isEncryptedPayload won't match
      const customEncrypted = JSON.stringify({
        customFormat: true,
        data: 'encrypted-blob',
      })

      const mockFile = { text: vi.fn().mockResolvedValue(customEncrypted) }
      const mockFileHandle = { getFile: vi.fn().mockResolvedValue(mockFile) }
      mockDirectoryHandle.getFileHandle.mockResolvedValue(mockFileHandle)

      // Set hooks that recognize this custom format
      service.setEncryptionHooks({
        encrypt: vi.fn(),
        decrypt: vi.fn(),
        isEncrypted: (data: any) => data?.customFormat === true,
      })

      // ACT
      const result = await service.checkFileEncryptionStatus()

      // ASSERT
      expect(result).toEqual({ exists: true, encrypted: true })
    })
  })
})
