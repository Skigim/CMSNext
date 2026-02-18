import { useCallback, useEffect, useState } from "react";
import {
  getPaperCuts,
  removePaperCut,
  clearPaperCuts,
  exportPaperCuts as exportPaperCutsFromStorage,
} from "@/utils/paperCutStorage";
import { safeNotifyFileStorageChange } from "@/utils/fileStorageNotify";
import type { PaperCut } from "@/types/paperCut";

interface UsePaperCutsResult {
  paperCuts: PaperCut[];
  loading: boolean;
  error: string | null;
  fetchPaperCuts: () => void;
  deletePaperCut: (id: string) => boolean;
  clearAllPaperCuts: () => boolean;
  exportPaperCuts: () => string;
}

export function usePaperCuts(): UsePaperCutsResult {
  const [paperCuts, setPaperCuts] = useState<PaperCut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPaperCuts = useCallback(() => {
    setLoading(true);
    try {
      setPaperCuts(getPaperCuts());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load paper cuts");
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePaperCut = useCallback((id: string): boolean => {
    try {
      removePaperCut(id);
      safeNotifyFileStorageChange();
      fetchPaperCuts();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete paper cut");
      return false;
    }
  }, [fetchPaperCuts]);

  const clearAllPaperCuts = useCallback((): boolean => {
    try {
      clearPaperCuts();
      safeNotifyFileStorageChange();
      fetchPaperCuts();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear paper cuts");
      return false;
    }
  }, [fetchPaperCuts]);

  const exportPaperCuts = useCallback((): string => {
    try {
      setError(null);
      return exportPaperCutsFromStorage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export paper cuts");
      return "";
    }
  }, []);

  useEffect(() => {
    fetchPaperCuts();
  }, [fetchPaperCuts]);

  return {
    paperCuts,
    loading,
    error,
    fetchPaperCuts,
    deletePaperCut,
    clearAllPaperCuts,
    exportPaperCuts,
  };
}
