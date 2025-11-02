import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockCaseDisplay, toast as mockToast } from "@/src/test/testUtils";
import { useFileDataSync } from "@/hooks/useFileDataSync";
import type { CaseDisplay } from "@/types/case";

type DataHandler = (payload: unknown) => void;
const dataLoadHandlers: DataHandler[] = [];

const fileStorageFlagsModule = vi.hoisted(() => ({
  updateFileStorageFlags: vi.fn(),
}));

const applicationStateModule = vi.hoisted(() => {
  const createAppStateMock = () => ({
    setCasesFromLegacyDisplays: vi.fn(),
    setHasLoadedCases: vi.fn(),
    setCasesError: vi.fn(),
  });

  const appStateMock = createAppStateMock();

  const getInstanceMock = vi.fn(() => appStateMock);

  return {
    appStateMock,
    createAppStateMock,
    getInstanceMock,
  };
});

vi.mock("@/application/ApplicationState", () => ({
  default: {
    getInstance: applicationStateModule.getInstanceMock,
  },
}));

vi.mock("@/contexts/FileStorageContext", () => ({
  useFileStorageDataLoadHandler: (handler: DataHandler) => {
    dataLoadHandlers.push(handler);
  },
}));

vi.mock("@/utils/fileStorageFlags", () => fileStorageFlagsModule);

const updateFileStorageFlagsMock = fileStorageFlagsModule.updateFileStorageFlags;


describe("useFileDataSync", () => {
  let loadCasesMock: ReturnType<typeof vi.fn>;
  let setConfigFromFileMock: ReturnType<typeof vi.fn>;

  const renderHookWithDeps = () =>
    renderHook(() =>
      useFileDataSync({
        loadCases: loadCasesMock as unknown as () => Promise<CaseDisplay[]>,
        setConfigFromFile: setConfigFromFileMock as unknown as (config?: Partial<Record<string, unknown>> | null) => void,
      }),
    );

  beforeEach(() => {
    dataLoadHandlers.length = 0;
    loadCasesMock = vi.fn().mockResolvedValue(undefined);
    setConfigFromFileMock = vi.fn();
    updateFileStorageFlagsMock.mockClear();
    
    // Reset ApplicationState mock
    applicationStateModule.appStateMock = applicationStateModule.createAppStateMock();
    applicationStateModule.getInstanceMock.mockClear();
    applicationStateModule.getInstanceMock.mockImplementation(() => applicationStateModule.appStateMock);
    
    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.info.mockClear();
    mockToast.warning.mockClear();
    mockToast.loading.mockClear();
    mockToast.dismiss.mockClear();
  });

  it("syncs cases payloads and updates storage flags", () => {
    const categoryConfig = { groups: [] } as const;
    const sampleCases = [createMockCaseDisplay()];

    renderHookWithDeps();
    expect(dataLoadHandlers).toHaveLength(1);

    act(() => {
      dataLoadHandlers[0]({
        cases: sampleCases,
        categoryConfig,
      });
    });

    expect(setConfigFromFileMock).toHaveBeenCalledWith(categoryConfig);
    expect(applicationStateModule.appStateMock.setCasesFromLegacyDisplays).toHaveBeenCalledWith(sampleCases);
    expect(applicationStateModule.appStateMock.setHasLoadedCases).toHaveBeenCalledWith(true);
    expect(updateFileStorageFlagsMock).toHaveBeenCalledWith({
      dataBaseline: true,
      sessionHadData: true,
    });
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("reloads cases when raw people and records are loaded", async () => {
    renderHookWithDeps();
    const handler = dataLoadHandlers[0];

    act(() => {
      handler({
        people: [{ id: "person-1" }],
        caseRecords: [{ id: "case-record-1" }],
      });
    });

    expect(applicationStateModule.appStateMock.setHasLoadedCases).toHaveBeenCalledWith(true);
    expect(applicationStateModule.appStateMock.setCasesFromLegacyDisplays).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(loadCasesMock).toHaveBeenCalledTimes(1);
    });
  });

  it("surfaces toast errors when sync fails", () => {
    applicationStateModule.appStateMock.setCasesFromLegacyDisplays.mockImplementation(() => {
      throw new Error("sync failed");
    });

    renderHookWithDeps();

    act(() => {
      dataLoadHandlers[0]({ cases: [createMockCaseDisplay()] });
    });

    // Error is caught and logged, but does NOT call setCasesError
    // The error toast is shown to the user instead
    expect(mockToast.error).toHaveBeenCalledWith("Failed to load data");
  });
});
