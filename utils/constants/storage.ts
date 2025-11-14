/**
 * Storage Constants
 * 
 * Centralized configuration for file names, versions, and storage-related constants.
 * Single source of truth to prevent duplication and ensure consistency across services.
 */

export const STORAGE_CONSTANTS = {
  ALERTS: {
    FILE_NAME: 'alerts.json',
    CSV_NAME: 'Alerts.csv',
    STORAGE_VERSION: 3,
  },
  DATA: {
    FILE_NAME: 'data.json',
  },
} as const;

export type StorageConstants = typeof STORAGE_CONSTANTS;
