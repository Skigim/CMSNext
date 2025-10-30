import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CaseManagementService } from '@/application/services/CaseManagementService';
import { ApplicationState } from '@/application/ApplicationState';
import { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import { Case } from '@/domain/cases/entities/Case';
import { Person } from '@/domain/cases/entities/Person';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('CaseManagementService', () => {
  let appState: ApplicationState;
  let storage: StorageRepository;
  let service: CaseManagementService;

  beforeEach(() => {
    // Reset ApplicationState for each test
    ApplicationState.resetForTesting();
    appState = ApplicationState.getInstance();

    // Mock storage
    storage = {
      cases: {
        getAll: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      },
    } as unknown as StorageRepository;

    service = new CaseManagementService(appState, storage);

    // Clear toast mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    ApplicationState.resetForTesting();
  });

  describe('loadCases', () => {
    it('should load all cases', async () => {
      // Arrange
      const person = Person.create({
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
      });

      const testCase = Case.create({
        mcn: 'MCN-001',
        name: 'Test Case',
        personId: person.id,
        person,
      });

      vi.mocked(storage.cases.getAll).mockResolvedValue([testCase]);

      // Act
      const result = await service.loadCases();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].mcn).toBe('MCN-001');
    });
  });

  describe('createCaseWithFeedback', () => {
    it('should create case and show success toast', async () => {
      // Arrange
      const caseData = {
        mcn: 'MCN-002',
        name: 'New Case',
        person: {
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: '1985-05-15',
        },
      };

      vi.mocked(storage.cases.save).mockResolvedValue(undefined);

      // Act
      const result = await service.createCaseWithFeedback(caseData);

      // Assert
      expect(result).toBeDefined();
      expect(result.mcn).toBe('MCN-002');
      expect(toast.loading).toHaveBeenCalledWith('Creating case...');
      expect(toast.success).toHaveBeenCalledWith(
        'Case for Jane Smith created successfully',
        { id: 'toast-id' }
      );
    });

    it('should show error toast on failure', async () => {
      // Arrange
      const caseData = {
        mcn: 'MCN-003',
        name: 'Failed Case',
        person: {
          firstName: 'Bob',
          lastName: 'Jones',
          dateOfBirth: '1975-03-20',
        },
      };

      vi.mocked(storage.cases.save).mockRejectedValue(new Error('Storage error'));

      // Act & Assert
      await expect(service.createCaseWithFeedback(caseData)).rejects.toThrow();
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('updateCaseWithFeedback', () => {
    it('should update case and show success toast', async () => {
      // Arrange
      const person = Person.create({
        firstName: 'Alice',
        lastName: 'Wonder',
        dateOfBirth: '1992-07-10',
      });

      const existingCase = Case.create({
        mcn: 'MCN-004',
        name: 'Existing Case',
        personId: person.id,
        person,
      });

      appState.addCase(existingCase);

      vi.mocked(storage.cases.save).mockResolvedValue(undefined);

      // Act
      const result = await service.updateCaseWithFeedback(existingCase.id, {
        name: 'Updated Case',
      });

      // Assert
      expect(result.name).toBe('Updated Case');
      expect(toast.success).toHaveBeenCalledWith('Case updated successfully', {
        id: 'toast-id',
      });
    });
  });

  describe('updateCaseStatus', () => {
    it('should update case status and show success toast', async () => {
      // Arrange
      const person = Person.create({
        firstName: 'Charlie',
        lastName: 'Brown',
        dateOfBirth: '1988-12-25',
      });

      const existingCase = Case.create({
        mcn: 'MCN-005',
        name: 'Status Test Case',
        personId: person.id,
        person,
        status: 'Active',
      });

      appState.addCase(existingCase);

      vi.mocked(storage.cases.save).mockResolvedValue(undefined);

      // Act
      const result = await service.updateCaseStatus(existingCase.id, 'Closed');

      // Assert
      expect(result.status).toBe('Closed');
      expect(toast.success).toHaveBeenCalledWith('Status updated to Closed', {
        id: 'toast-id',
        duration: 2000,
      });
    });

    it('should dismiss toast on AbortError', async () => {
      // Arrange
      const person = Person.create({
        firstName: 'Diana',
        lastName: 'Prince',
        dateOfBirth: '1980-06-01',
      });

      const existingCase = Case.create({
        mcn: 'MCN-006',
        name: 'Abort Test Case',
        personId: person.id,
        person,
      });

      appState.addCase(existingCase);

      const abortError = new Error('User cancelled');
      abortError.name = 'AbortError';
      vi.mocked(storage.cases.save).mockRejectedValue(abortError);

      // Act & Assert
      await expect(
        service.updateCaseStatus(existingCase.id, 'Pending')
      ).rejects.toThrow('User cancelled');
      expect(toast.dismiss).toHaveBeenCalledWith('toast-id');
    });
  });

  describe('deleteCaseWithFeedback', () => {
    it('should delete case and show success toast', async () => {
      // Arrange
      const person = Person.create({
        firstName: 'Eve',
        lastName: 'Adams',
        dateOfBirth: '1995-09-15',
      });

      const existingCase = Case.create({
        mcn: 'MCN-007',
        name: 'Delete Test Case',
        personId: person.id,
        person,
      });

      appState.addCase(existingCase);

      vi.mocked(storage.cases.delete).mockResolvedValue(undefined);

      // Act
      await service.deleteCaseWithFeedback(existingCase.id, 'Eve Adams');

      // Assert
      expect(toast.success).toHaveBeenCalledWith('Eve Adams deleted successfully');
    });

    it('should use default name if not provided', async () => {
      // Arrange
      const person = Person.create({
        firstName: 'Frank',
        lastName: 'Castle',
        dateOfBirth: '1970-01-01',
      });

      const existingCase = Case.create({
        mcn: 'MCN-008',
        name: 'Default Name Test',
        personId: person.id,
        person,
      });

      appState.addCase(existingCase);

      vi.mocked(storage.cases.delete).mockResolvedValue(undefined);

      // Act
      await service.deleteCaseWithFeedback(existingCase.id);

      // Assert
      expect(toast.success).toHaveBeenCalledWith('Case deleted successfully');
    });
  });

  describe('getCases', () => {
    it('should get cases from ApplicationState', () => {
      // Arrange
      const person = Person.create({
        firstName: 'Grace',
        lastName: 'Hopper',
        dateOfBirth: '1906-12-09',
      });

      const testCase = Case.create({
        mcn: 'MCN-009',
        name: 'Get Test Case',
        personId: person.id,
        person,
      });

      appState.addCase(testCase);

      // Act
      const result = service.getCases();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].mcn).toBe('MCN-009');
    });
  });

  describe('getCase', () => {
    it('should get a specific case from ApplicationState', () => {
      // Arrange
      const person = Person.create({
        firstName: 'Hedy',
        lastName: 'Lamarr',
        dateOfBirth: '1914-11-09',
      });

      const testCase = Case.create({
        mcn: 'MCN-010',
        name: 'Get Single Case',
        personId: person.id,
        person,
      });

      appState.addCase(testCase);

      // Act
      const result = service.getCase(testCase.id);

      // Assert
      expect(result).toBeDefined();
      expect(result?.mcn).toBe('MCN-010');
    });

    it('should return null for non-existent case', () => {
      // Act
      const result = service.getCase('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });
  });
});
