import type { EncryptionMode } from "@/types/encryption";

export type AppEnvironment = "dev" | "staging" | "production";

type RawEnvValue = string | boolean | undefined;

type AppConfigEnvKey =
  | "APP_ENV"
  | "ENCRYPTION_MODE"
  | "DEVTOOLS_ENABLED"
  | "SCHEMA_INSPECTOR_ENABLED"
  | "DATA_FLOW_DEBUG_ENABLED"
  | "VERBOSE_LOGGING"
  | "VITE_APP_ENV"
  | "VITE_ENCRYPTION_MODE"
  | "VITE_DEVTOOLS_ENABLED"
  | "VITE_SCHEMA_INSPECTOR_ENABLED"
  | "VITE_DATA_FLOW_DEBUG_ENABLED"
  | "VITE_VERBOSE_LOGGING"
  | "MODE"
  | "NODE_ENV"
  | "DEV"
  | "PROD";

export type AppConfigEnvSource = Partial<Record<AppConfigEnvKey, RawEnvValue>>;
type ConfigurableEnvKey = Exclude<AppConfigEnvKey, "MODE" | "NODE_ENV" | "DEV" | "PROD">;

const CONFIG_ENV_VITE_KEYS: Record<ConfigurableEnvKey, keyof AppConfigEnvSource> = {
  APP_ENV: "VITE_APP_ENV",
  ENCRYPTION_MODE: "VITE_ENCRYPTION_MODE",
  DEVTOOLS_ENABLED: "VITE_DEVTOOLS_ENABLED",
  SCHEMA_INSPECTOR_ENABLED: "VITE_SCHEMA_INSPECTOR_ENABLED",
  DATA_FLOW_DEBUG_ENABLED: "VITE_DATA_FLOW_DEBUG_ENABLED",
  VERBOSE_LOGGING: "VITE_VERBOSE_LOGGING",
  VITE_APP_ENV: "VITE_APP_ENV",
  VITE_ENCRYPTION_MODE: "VITE_ENCRYPTION_MODE",
  VITE_DEVTOOLS_ENABLED: "VITE_DEVTOOLS_ENABLED",
  VITE_SCHEMA_INSPECTOR_ENABLED: "VITE_SCHEMA_INSPECTOR_ENABLED",
  VITE_DATA_FLOW_DEBUG_ENABLED: "VITE_DATA_FLOW_DEBUG_ENABLED",
  VITE_VERBOSE_LOGGING: "VITE_VERBOSE_LOGGING",
};

export interface AppConfig {
  appEnv: AppEnvironment;
  encryptionMode: EncryptionMode;
  devtoolsEnabled: boolean;
  schemaInspectorEnabled: boolean;
  dataFlowDebugEnabled: boolean;
  verboseLogging: boolean;
}

const APP_ENV_VALUES = ["dev", "staging", "production"] as const;
const ENCRYPTION_MODE_VALUES = ["disabled", "noop", "full"] as const;

function readImportMetaEnv(): AppConfigEnvSource {
  return ((import.meta as ImportMeta & { env?: AppConfigEnvSource }).env ?? {}) as AppConfigEnvSource;
}

function readProcessEnv(): AppConfigEnvSource {
  if (typeof process === "undefined" || process.env === undefined) {
    return {};
  }

  return process.env as AppConfigEnvSource;
}

function normalizeEnvValue(value: RawEnvValue): string | undefined {
  if (typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

function getEnvValue(env: AppConfigEnvSource, key: ConfigurableEnvKey): string | undefined {
  const viteKey = CONFIG_ENV_VITE_KEYS[key];

  return normalizeEnvValue(env[viteKey]) ?? normalizeEnvValue(env[key]);
}

function parseBooleanEnv(
  env: AppConfigEnvSource,
  key: "DEVTOOLS_ENABLED" | "SCHEMA_INSPECTOR_ENABLED" | "DATA_FLOW_DEBUG_ENABLED" | "VERBOSE_LOGGING",
  defaultValue: boolean,
): boolean {
  const rawValue = getEnvValue(env, key);
  if (rawValue === undefined) {
    return defaultValue;
  }

  const normalized = rawValue.toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new Error(`Invalid ${key} value "${rawValue}". Expected "true" or "false".`);
}

function parseEnumValue<T extends string>(
  rawValue: string | undefined,
  label: string,
  allowedValues: readonly T[],
  defaultValue: T,
): T {
  if (rawValue === undefined) {
    return defaultValue;
  }

  if (allowedValues.includes(rawValue as T)) {
    return rawValue as T;
  }

  throw new Error(
    `Invalid ${label} value "${rawValue}". Expected one of: ${allowedValues.join(", ")}.`,
  );
}

function deriveDefaultAppEnvironment(env: AppConfigEnvSource): AppEnvironment {
  const mode = normalizeEnvValue(env.MODE)?.toLowerCase();
  const nodeEnv = normalizeEnvValue(env.NODE_ENV)?.toLowerCase();
  const isDev = normalizeEnvValue(env.DEV) === "true";
  const isProd = normalizeEnvValue(env.PROD) === "true";

  // Treat any explicit production signal as production.
  if (mode === "production" || nodeEnv === "production" || isProd) {
    return "production";
  }

  // Treat typical dev/test signals as development.
  if (
    mode === "development" ||
    nodeEnv === "development" ||
    nodeEnv === "test" ||
    isDev
  ) {
    return "dev";
  }

  // Fallback to a safe non-production default when environment is ambiguous.
  return "dev";
}

export function validateAppConfig(config: AppConfig): void {
  const errors: string[] = [];

  if (config.appEnv === "production") {
    if (config.encryptionMode !== "full") {
      errors.push("production requires ENCRYPTION_MODE=full");
    }
    if (config.devtoolsEnabled) {
      errors.push("production requires DEVTOOLS_ENABLED=false");
    }
    if (config.schemaInspectorEnabled) {
      errors.push("production requires SCHEMA_INSPECTOR_ENABLED=false");
    }
    if (config.dataFlowDebugEnabled) {
      errors.push("production requires DATA_FLOW_DEBUG_ENABLED=false");
    }
    if (config.verboseLogging) {
      errors.push("production requires VERBOSE_LOGGING=false");
    }
  }

  if (config.appEnv === "staging" && config.encryptionMode !== "full") {
    errors.push("staging requires ENCRYPTION_MODE=full");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid app configuration:\n- ${errors.join("\n- ")}`);
  }
}

export function createAppConfig(env: AppConfigEnvSource = {}): AppConfig {
  const mergedEnv: AppConfigEnvSource = {
    ...readProcessEnv(),
    ...readImportMetaEnv(),
    ...env,
  };

  const appEnv = parseEnumValue(
    getEnvValue(mergedEnv, "APP_ENV"),
    "APP_ENV",
    APP_ENV_VALUES,
    deriveDefaultAppEnvironment(mergedEnv),
  );

  const defaultEncryptionMode: EncryptionMode = appEnv === "dev" ? "disabled" : "full";

  const encryptionMode = parseEnumValue(
    getEnvValue(mergedEnv, "ENCRYPTION_MODE"),
    "ENCRYPTION_MODE",
    ENCRYPTION_MODE_VALUES,
    defaultEncryptionMode,
  );

  const devtoolsEnabled = parseBooleanEnv(
    mergedEnv,
    "DEVTOOLS_ENABLED",
    appEnv !== "production",
  );
  const schemaInspectorEnabled = parseBooleanEnv(
    mergedEnv,
    "SCHEMA_INSPECTOR_ENABLED",
    appEnv !== "production",
  );
  const dataFlowDebugEnabled = parseBooleanEnv(
    mergedEnv,
    "DATA_FLOW_DEBUG_ENABLED",
    appEnv !== "production",
  );
  const verboseLogging = parseBooleanEnv(
    mergedEnv,
    "VERBOSE_LOGGING",
    appEnv !== "production",
  );

  const config: AppConfig = Object.freeze({
    appEnv,
    encryptionMode,
    devtoolsEnabled,
    schemaInspectorEnabled,
    dataFlowDebugEnabled,
    verboseLogging,
  });

  validateAppConfig(config);
  return config;
}

/**
 * Immutable runtime app configuration.
 *
 * This is resolved at module load time and intentionally fails fast when the
 * environment is invalid or unsafe. See `validateAppConfig()` for the enforced
 * production and staging safety constraints.
 */
export const APP_CONFIG = createAppConfig();
