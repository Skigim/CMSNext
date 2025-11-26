import { act, renderHook, waitFor } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockCaseDisplay, toast as mockToast } from "@/src/test/testUtils";
import type { StoredCase } from "@/types/case";
import { useFileDataSync } from "@/hooks/useFileDataSync";

type DataHandler = (payload: unknown) => void;
const dataLoadHandlers: DataHandler[] = [];

const fileStorageFlagsModule = vi.hoisted(() => ({
  updateFileStorageFlags: vi.fn(),
}));

vi.mock("@/contexts/FileStorageContext", () => ({
  useFileStorageDataLoadHandler: (handler: DataHandler) => {
    dataLoadHandlers.push(handler);
  },
  useFileStorage: () => ({
    fileStorageService: {},
  }),
}));

vi.mock("@/utils/fileStorageFlags", () => fileStorageFlagsModule);

const updateFileStorageFlagsMock = fileStorageFlagsModule.updateFileStorageFlags;


describe("useFileDataSync", () => {
  let loadCasesMock: ReturnType<typeof vi.fn>;
  let setCasesMock: ReturnType<typeof vi.fn>;
  let setHasLoadedDataMock: ReturnType<typeof vi.fn>;
  let setConfigFromFileMock: ReturnType<typeof vi.fn>;

  const renderHookWithDeps = () =>
    renderHook(() =>
      useFileDataSync({
        loadCases: loadCasesMock as unknown as () => Promise<void>,
        setCases: setCasesMock as unknown as Dispatch<SetStateAction<StoredCase[]>>,
        setHasLoadedData: setHasLoadedDataMock as unknown as (value: boolean) => void,
        setConfigFromFile: setConfigFromFileMock as unknown as (config?: Partial<Record<string, unknown>> | null) => void,
      }),
    );

  beforeEach(() => {
    dataLoadHandlers.length = 0;
    loadCasesMock = vi.fn().mockResolvedValue(undefined);
    setCasesMock = vi.fn();
    setHasLoadedDataMock = vi.fn();
    setConfigFromFileMock = vi.fn();
    updateFileStorageFlagsMock.mockClear();
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
    expect(setCasesMock).toHaveBeenCalledWith(sampleCases);
    expect(setHasLoadedDataMock).toHaveBeenCalledWith(true);
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

    expect(setHasLoadedDataMock).toHaveBeenCalledWith(true);
    expect(setCasesMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(loadCasesMock).toHaveBeenCalledTimes(1);
    });
  });

  it("surfaces toast errors when sync fails", () => {
    setCasesMock.mockImplementation(() => {
      throw new Error("sync failed");
    });

    renderHookWithDeps();

    act(() => {
      dataLoadHandlers[0]({ cases: [createMockCaseDisplay()] });
    });

    expect(mockToast.error).toHaveBeenCalledWith("Failed to load data");
  });
});
