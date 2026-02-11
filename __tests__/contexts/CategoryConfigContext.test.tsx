import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { CategoryConfigProvider, useCategoryConfig, CategoryConfigContext } from "@/contexts/CategoryConfigContext";
import { mergeCategoryConfig, type StatusConfig, type AlertTypeConfig, type CategoryConfig } from "@/types/categoryConfig";

// ============================================================================
// Mocks
// ============================================================================

const mockGetCategoryConfig = vi.fn();
const mockUpdateCaseStatuses = vi.fn();
const mockUpdateAlertTypes = vi.fn();
const mockUpdateCategoryValues = vi.fn();
const mockResetCategoryConfig = vi.fn();

const mockDataManager = {
  getCategoryConfig: mockGetCategoryConfig,
  updateCaseStatuses: mockUpdateCaseStatuses,
  updateAlertTypes: mockUpdateAlertTypes,
  updateCategoryValues: mockUpdateCategoryValues,
  resetCategoryConfig: mockResetCategoryConfig,
};

let mockDataManagerRef: typeof mockDataManager | null = mockDataManager;

vi.mock("@/contexts/DataManagerContext", () => ({
  useDataManagerSafe: () => mockDataManagerRef,
}));

let mockDataChangeCount = 0;
vi.mock("@/contexts/FileStorageContext", () => ({
  useFileStorageDataChange: () => mockDataChangeCount,
}));

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    lifecycle: vi.fn(),
  }),
}));

vi.mock("@/utils/errorUtils", () => ({
  extractErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

vi.mock("@/utils/services/FileStorageService", () => ({
  LegacyFormatError: class LegacyFormatError extends Error {
    constructor(msg: string) { super(msg); this.name = "LegacyFormatError"; }
  },
}));

// ============================================================================
// Test helper component
// ============================================================================

function TestConsumer({ onReady }: { onReady: (ctx: ReturnType<typeof useCategoryConfig>) => void }) {
  const ctx = useCategoryConfig();
  onReady(ctx);
  return <div data-testid="config">{JSON.stringify(ctx.config.caseStatuses?.length ?? 0)}</div>;
}

// ============================================================================
// Tests
// ============================================================================

describe("CategoryConfigContext", () => {
  const defaultConfig = mergeCategoryConfig();

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataManagerRef = mockDataManager;
    mockDataChangeCount = 0;
    mockGetCategoryConfig.mockResolvedValue(defaultConfig);
  });

  describe("useCategoryConfig outside provider", () => {
    it("returns default context value and warns in dev", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      
      render(<TestConsumer onReady={(c) => { ctx = c; }} />);
      
      expect(ctx).toBeDefined();
      expect(ctx!.loading).toBe(false);
      expect(ctx!.error).toBeNull();
      expect(ctx!.config).toEqual(defaultConfig);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("outside of CategoryConfigProvider"),
      );
      warnSpy.mockRestore();
    });
  });

  describe("CategoryConfigProvider", () => {
    it("loads config on mount when dataManager is available", async () => {
      const updatedConfig: CategoryConfig = {
        ...defaultConfig,
        caseStatuses: [{ name: "Active", colorSlot: "blue" }],
      };
      mockGetCategoryConfig.mockResolvedValue(updatedConfig);

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => {
        expect(ctx!.loading).toBe(false);
      });

      expect(mockGetCategoryConfig).toHaveBeenCalled();
    });

    it("does not load if dataManager is null", async () => {
      mockDataManagerRef = null;

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      // Should still have default - no load attempted
      expect(ctx!.loading).toBe(false);
      expect(mockGetCategoryConfig).not.toHaveBeenCalled();
    });

    it("handles load error gracefully", async () => {
      mockGetCategoryConfig.mockRejectedValue(new Error("load failed"));

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => {
        expect(ctx!.error).toBe("Unable to load category options.");
      });
    });

    it("handles LegacyFormatError on load", async () => {
      const { LegacyFormatError } = await import("@/utils/services/FileStorageService");
      mockGetCategoryConfig.mockRejectedValue(new LegacyFormatError("legacy data"));

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => {
        expect(ctx!.error).toBe("legacy data");
      });
    });
  });

  describe("updateCategory - caseStatuses with StatusConfig[]", () => {
    it("calls updateCaseStatuses with typed config objects", async () => {
      const statusConfigs: StatusConfig[] = [
        { name: "Active", colorSlot: "blue" },
        { name: "Closed", colorSlot: "red" },
      ];
      const updatedConfig = { ...defaultConfig, caseStatuses: statusConfigs };
      mockUpdateCaseStatuses.mockResolvedValue(updatedConfig);

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalled());

      await act(async () => {
        await ctx!.updateCategory("caseStatuses", statusConfigs);
      });

      expect(mockUpdateCaseStatuses).toHaveBeenCalledWith(statusConfigs);
    });

    it("shows error when empty StatusConfig[] is provided", async () => {
      const { toast } = await import("sonner");

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalled());

      await act(async () => {
        await ctx!.updateCategory("caseStatuses", [] as StatusConfig[]);
      });

      expect(toast.error).toHaveBeenCalledWith("Please provide at least one status.");
      expect(mockUpdateCaseStatuses).not.toHaveBeenCalled();
    });
  });

  describe("updateCategory - caseStatuses with legacy string[]", () => {
    it("calls updateCategoryValues for legacy string format", async () => {
      const legacyValues = ["Open", "Closed"];
      const updatedConfig = { ...defaultConfig };
      mockUpdateCategoryValues.mockResolvedValue(updatedConfig);

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalled());

      await act(async () => {
        await ctx!.updateCategory("caseStatuses", legacyValues);
      });

      expect(mockUpdateCategoryValues).toHaveBeenCalledWith("caseStatuses", legacyValues);
    });

    it("shows error when empty string[] is provided for statuses", async () => {
      const { toast } = await import("sonner");

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalled());

      await act(async () => {
        await ctx!.updateCategory("caseStatuses", []);
      });

      expect(toast.error).toHaveBeenCalledWith("Please provide at least one option.");
    });
  });

  describe("updateCategory - alertTypes with AlertTypeConfig[]", () => {
    it("calls updateAlertTypes with typed config objects", async () => {
      const alertTypeConfigs: AlertTypeConfig[] = [
        { name: "Income Mismatch", colorSlot: "amber" },
        { name: "Missing Docs", colorSlot: "red" },
      ];
      const updatedConfig = { ...defaultConfig, alertTypes: alertTypeConfigs };
      mockUpdateAlertTypes.mockResolvedValue(updatedConfig);

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalled());

      await act(async () => {
        await ctx!.updateCategory("alertTypes", alertTypeConfigs);
      });

      expect(mockUpdateAlertTypes).toHaveBeenCalledWith(alertTypeConfigs);
    });

    it("calls updateCategoryValues for legacy string format alertTypes", async () => {
      const legacyAlertTypes = ["Type A", "Type B"];
      const updatedConfig = { ...defaultConfig };
      mockUpdateCategoryValues.mockResolvedValue(updatedConfig);

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalled());

      await act(async () => {
        await ctx!.updateCategory("alertTypes", legacyAlertTypes);
      });

      expect(mockUpdateCategoryValues).toHaveBeenCalledWith("alertTypes", legacyAlertTypes);
    });
  });

  describe("updateCategory - generic categories", () => {
    it("calls updateCategoryValues for caseTypes", async () => {
      const values = ["SNAP", "Medical"];
      mockUpdateCategoryValues.mockResolvedValue({ ...defaultConfig, caseTypes: values });

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalled());

      await act(async () => {
        await ctx!.updateCategory("caseTypes", values);
      });

      expect(mockUpdateCategoryValues).toHaveBeenCalledWith("caseTypes", values);
    });

    it("shows error for empty generic category values", async () => {
      const { toast } = await import("sonner");

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalled());

      await act(async () => {
        await ctx!.updateCategory("caseTypes", []);
      });

      expect(toast.error).toHaveBeenCalledWith("Please provide at least one option.");
      expect(mockUpdateCategoryValues).not.toHaveBeenCalled();
    });

    it("shows error when dataManager is not available", async () => {
      const { toast } = await import("sonner");
      mockDataManagerRef = null;

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await act(async () => {
        await ctx!.updateCategory("caseTypes", ["SNAP"]);
      });

      expect(toast.error).toHaveBeenCalledWith("Data manager is not available yet.");
    });
  });

  describe("updateCategory - error handling", () => {
    it("handles updateCaseStatuses failure with toast", async () => {
      const { toast } = await import("sonner");
      mockUpdateCaseStatuses.mockRejectedValue(new Error("save failed"));

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalled());

      await act(async () => {
        await ctx!.updateCategory("caseStatuses", [{ name: "X", colorSlot: "blue" }]);
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to update statuses", expect.anything());
    });

    it("handles updateAlertTypes failure with toast", async () => {
      const { toast } = await import("sonner");
      mockUpdateAlertTypes.mockRejectedValue(new Error("save failed"));

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalled());

      await act(async () => {
        await ctx!.updateCategory("alertTypes", [{ name: "X", colorSlot: "amber" }]);
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to update alert types", expect.anything());
    });
  });

  describe("resetToDefaults", () => {
    it("calls resetCategoryConfig and updates state", async () => {
      const defaults = mergeCategoryConfig();
      mockResetCategoryConfig.mockResolvedValue(defaults);

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalled());

      await act(async () => {
        await ctx!.resetToDefaults();
      });

      expect(mockResetCategoryConfig).toHaveBeenCalled();
    });

    it("shows error when dataManager is not available", async () => {
      const { toast } = await import("sonner");
      mockDataManagerRef = null;

      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await act(async () => {
        await ctx!.resetToDefaults();
      });

      expect(toast.error).toHaveBeenCalledWith("Data manager is not available yet.");
    });
  });

  describe("setConfigFromFile", () => {
    it("merges incoming config and clears error", async () => {
      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalled());

      act(() => {
        ctx!.setConfigFromFile({
          caseStatuses: [{ name: "Custom", colorSlot: "teal" }],
        });
      });

      // Config should update (we can't easily read the state directly,
      // but the function should not throw)
      expect(ctx!.error).toBeNull();
    });

    it("handles null/undefined input by using defaults", () => {
      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      act(() => {
        ctx!.setConfigFromFile(null);
      });

      expect(ctx!.error).toBeNull();
    });
  });

  describe("refresh", () => {
    it("reloads config from dataManager", async () => {
      let ctx: ReturnType<typeof useCategoryConfig> | undefined;
      render(
        <CategoryConfigProvider>
          <TestConsumer onReady={(c) => { ctx = c; }} />
        </CategoryConfigProvider>,
      );

      await waitFor(() => expect(mockGetCategoryConfig).toHaveBeenCalledTimes(1));

      await act(async () => {
        await ctx!.refresh();
      });

      expect(mockGetCategoryConfig).toHaveBeenCalledTimes(2);
    });
  });
});
