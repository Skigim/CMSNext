import { useCallback } from "react";
import { toast } from "sonner";
import { useFileStorageDataLoadHandler } from "@/contexts/FileStorageContext";
import type { Dispatch, SetStateAction } from "react";
import type { CaseDisplay } from "@/types/case";
import type { CategoryConfig } from "@/types/categoryConfig";
import { createLogger } from "@/utils/logger";
import { updateFileStorageFlags } from "@/utils/fileStorageFlags";

interface FileDataSyncDependencies {
  loadCases: () => Promise<void>;
  setCases: Dispatch<SetStateAction<CaseDisplay[]>>;
  setHasLoadedData: (value: boolean) => void;
  setConfigFromFile: (config?: Partial<CategoryConfig> | null) => void;
}

const logger = createLogger("FileDataSync");

type FileDataPayload = {
  cases?: CaseDisplay[];
  people?: unknown[];
  caseRecords?: unknown[];
  categoryConfig?: Partial<CategoryConfig> | null;
  [key: string]: unknown;
} | null | undefined;

export function useFileDataSync({
  loadCases,
  setCases,
  setHasLoadedData,
  setConfigFromFile,
}: FileDataSyncDependencies) {
  const handleFileDataLoaded = useCallback(
    (fileData: unknown) => {
      const payload = (fileData ?? null) as FileDataPayload;
      try {
        logger.lifecycle("handleFileDataLoaded invoked", {
          hasCases: Array.isArray(payload?.cases),
          peopleCount: Array.isArray(payload?.people) ? payload?.people?.length : undefined,
        });

        if (payload && typeof payload === "object") {
          setConfigFromFile(payload.categoryConfig ?? null);
        } else {
          setConfigFromFile(undefined);
        }

        if (Array.isArray(payload?.cases)) {
          setCases(payload.cases);
          setHasLoadedData(true);
          updateFileStorageFlags({ dataBaseline: true, sessionHadData: payload.cases.length > 0 });
          return;
        }

        if (Array.isArray(payload?.people) && Array.isArray(payload?.caseRecords)) {
          logger.warn("Raw file data detected; scheduling DataManager reload", {
            peopleCount: payload.people.length,
            caseRecordCount: payload.caseRecords.length,
          });

          setHasLoadedData(true);

          setTimeout(() => {
            loadCases().catch(err =>
              logger.error("Failed to reload cases after file load", {
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          }, 100);
          return;
        }

        if (payload && Object.keys(payload).length === 0) {
          logger.info("Empty file data loaded and synced to UI");
          setCases([]);
          setHasLoadedData(true);
          updateFileStorageFlags({ dataBaseline: true, sessionHadData: false });
          return;
        }

        if (payload) {
          logger.warn("Unexpected file data format", { keys: Object.keys(payload) });
        }

        setCases([]);
        setHasLoadedData(true);
        updateFileStorageFlags({ dataBaseline: true, sessionHadData: false });
      } catch (err) {
        logger.error("Failed to handle file data loaded", {
          error: err instanceof Error ? err.message : String(err),
        });
        toast.error("Failed to load data");
      }
    },
    [loadCases, setCases, setConfigFromFile, setHasLoadedData],
  );

  useFileStorageDataLoadHandler(handleFileDataLoaded);
}