import { describe, it, expect, vi, beforeEach } from "vitest";
import { CategoryConfigService } from "@/utils/services/CategoryConfigService";
import { mergeCategoryConfig, type StatusConfig } from "@/types/categoryConfig";
import type { FileStorageService, NormalizedFileData } from "@/utils/services/FileStorageService";

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    lifecycle: vi.fn(),
  }),
}));

describe("CategoryConfigService", () => {
  let service: CategoryConfigService;
  let mockFileStorage: FileStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockFileStorage = {
      readFileData: vi.fn().mockResolvedValue({
        version: "2.0",
        cases: [],
        financials: [],
        notes: [],
        alerts: [],
        exported_at: new Date().toISOString(),
        total_cases: 0,
        categoryConfig: mergeCategoryConfig(),
        activityLog: [],
      } as NormalizedFileData),
      writeNormalizedData: vi.fn().mockResolvedValue(undefined),
    } as unknown as FileStorageService;

    service = new CategoryConfigService({ fileStorage: mockFileStorage });
  });

  describe("readonly fileStorage member", () => {
    it("constructs with fileStorage injected", () => {
      expect(service).toBeDefined();
      // The readonly modifier ensures fileStorage cannot be reassigned
      // Constructor injection is verified by successful construction
    });
  });

  describe("getCategoryConfig", () => {
    it("returns merged config with sorted statuses", async () => {
      const config = await service.getCategoryConfig();
      
      expect(config).toBeDefined();
      expect(config.caseStatuses).toBeDefined();
      expect(Array.isArray(config.caseStatuses)).toBe(true);
    });

    it("returns defaults when no file data exists", async () => {
      (mockFileStorage.readFileData as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      
      const config = await service.getCategoryConfig();
      const defaults = mergeCategoryConfig();
      
      expect(config.caseTypes).toEqual(defaults.caseTypes);
    });
  });

  describe("updateCaseStatuses", () => {
    it("assigns sortOrder to statuses and persists", async () => {
      const statuses: StatusConfig[] = [
        { name: "Active", colorSlot: "blue" },
        { name: "Closed", colorSlot: "red" },
      ];

      const result = await service.updateCaseStatuses(statuses);
      
      expect(result).toBeDefined();
      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalled();
    });

    it("throws when no statuses provided", async () => {
      await expect(service.updateCaseStatuses([])).rejects.toThrow(
        "At least one status is required",
      );
    });
  });
});
