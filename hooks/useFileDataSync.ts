import { useCallback } from "react";
import { toast } from "sonner";
import { useFileStorageDataLoadHandler } from "@/contexts/FileStorageContext";
import type { Dispatch, SetStateAction } from "react";
import type { StoredCase } from "@/types/case";
import type { CategoryConfig } from "@/types/categoryConfig";
import { createLogger } from "@/utils/logger";
import { updateFileStorageFlags } from "@/utils/fileStorageFlags";
import { recordStorageSyncEvent } from "@/utils/telemetryInstrumentation";

interface FileDataSyncDependencies {
  setCases: Dispatch<SetStateAction<StoredCase[]>>;
  setHasLoadedData: (value: boolean) => void;
  setConfigFromFile: (config?: Partial<CategoryConfig> | null) => void;
}

const logger = createLogger("FileDataSync");

type FileDataPayload = {
  cases?: StoredCase[];
  categoryConfig?: Partial<CategoryConfig> | null;
  [key: string]: unknown;
} | null | undefined;

/**
 * Hook for synchronizing file-system-loaded data into React component state
 * 
 * Handles the critical data load phase: when FileStorageContext loads JSON from disk,
 * this hook receives the event and distributes normalized data (cases, category config)
 * to the appropriate React state setters.
 * 
 * **Data Normalization:**
 * File format is v2.0 normalized (flat arrays with foreign keys):
 * ```json
 * {
 *   "cases": [ { "id": "c1", "caseNumber": "2024-001", ... }, ... ],
 *   "categoryConfig": { "statuses": [ { "name": "Active", "colorSlot": "blue" } ], ... },
 *   "financials": [ ... ],
 *   "notes": [ ... ],
 *   "alerts": [ ... ]
 * }
 * ```
 * 
 * **Setup in Component:**
 * Typically invoked once on mount, passed state setters from parent component:
 * ```typescript
 * const [cases, setCases] = useState<StoredCase[]>([]);
 * const [categoryConfig, setConfig] = useState<CategoryConfig | undefined>();
 * 
 * useFileDataSync({
 *   setCases,
 *   setConfigFromFile: setConfig,
 *   setHasLoadedData: setLoaded
 * });
 * ```
 * 
 * **Dependencies:**
 * - Requires `FileStorageContext` in tree (provides useFileStorageDataLoadHandler)
 * - Delegates logging to `createLogger("FileDataSync")`
 * - Reports sync events to telemetry via recordStorageSyncEvent()
 * 
 * @param {FileDataSyncDependencies} deps
 *   - `setCases`: State setter for loaded cases array
 *   - `setHasLoadedData`: Lifecycle flag (true = initial load complete)
 *   - `setConfigFromFile`: State setter for category config (nullable)
 * 
 * @returns {void} No return value; side effect only
 */
export function useFileDataSync({
  setCases,
  setHasLoadedData,
  setConfigFromFile,
}: FileDataSyncDependencies) {
  const handleFileDataLoaded = useCallback(
    async (fileData: unknown) => {
      const payload = (fileData ?? null) as FileDataPayload;
      const startTime = performance.now?.() ?? Date.now();
      try {
        logger.lifecycle("handleFileDataLoaded invoked", {
          hasCases: Array.isArray(payload?.cases),
        });

        if (payload && typeof payload === "object") {
          setConfigFromFile(payload.categoryConfig ?? null);
        } else {
          setConfigFromFile(undefined);
        }

        if (Array.isArray(payload?.cases)) {
          const endTime = performance.now?.() ?? Date.now();
          const duration = endTime - startTime;
          recordStorageSyncEvent("load", true, {
            duration,
            itemCount: payload.cases.length,
            metadata: { type: "caseData" },
          });
          setCases(payload.cases);
          setHasLoadedData(true);
          updateFileStorageFlags({ dataBaseline: true, sessionHadData: payload.cases.length > 0 });

          return;
        }

        if (payload && Object.keys(payload).length === 0) {
          logger.info("Empty file data loaded and synced to UI");
          recordStorageSyncEvent("load", true, {
            itemCount: 0,
            metadata: { type: "emptyData" },
          });
          setCases([]);
          setHasLoadedData(true);
          updateFileStorageFlags({ dataBaseline: true, sessionHadData: false });
          return;
        }

        if (payload) {
          logger.warn("Unexpected file data format", { keys: Object.keys(payload) });
          recordStorageSyncEvent("load", false, {
            error: "Unexpected file data format",
            metadata: { type: "formatError", keys: Object.keys(payload) },
          });
        }

        setCases([]);
        setHasLoadedData(true);
        updateFileStorageFlags({ dataBaseline: true, sessionHadData: false });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        recordStorageSyncEvent("load", false, {
          error: errorMessage,
          metadata: { type: "exception" },
        });
        logger.error("Failed to handle file data loaded", {
          error: errorMessage,
        });
        toast.error("Failed to load data");
      }
    },
    [setCases, setConfigFromFile, setHasLoadedData],
  );

  useFileStorageDataLoadHandler(handleFileDataLoaded);
}