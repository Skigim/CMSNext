import { describe, expect, it } from "vitest";
import { createAppConfig } from "@/utils/appConfig";

describe("appConfig", () => {
  it("derives dev defaults while keeping full encryption enabled", () => {
    // ARRANGE & ACT
    const config = createAppConfig({
      DEV: true,
      MODE: "development",
    });

    // ASSERT
    expect(config).toEqual({
      appEnv: "dev",
      encryptionMode: "full",
      devtoolsEnabled: true,
      schemaInspectorEnabled: true,
      dataFlowDebugEnabled: true,
      verboseLogging: true,
    });
  });

  it("accepts VITE-prefixed environment variables", () => {
    // ARRANGE & ACT
    const config = createAppConfig({
      VITE_APP_ENV: "staging",
      VITE_ENCRYPTION_MODE: "full",
      VITE_DEVTOOLS_ENABLED: "true",
      VITE_SCHEMA_INSPECTOR_ENABLED: "true",
      VITE_DATA_FLOW_DEBUG_ENABLED: "true",
      VITE_VERBOSE_LOGGING: "true",
    });

    // ASSERT
    expect(config).toEqual({
      appEnv: "staging",
      encryptionMode: "full",
      devtoolsEnabled: true,
      schemaInspectorEnabled: true,
      dataFlowDebugEnabled: true,
      verboseLogging: true,
    });
  });

  it("fails fast when staging disables full encryption", () => {
    // ACT & ASSERT
    expect(() =>
      createAppConfig({
        APP_ENV: "staging",
        ENCRYPTION_MODE: "noop",
      }),
    ).toThrow("staging requires ENCRYPTION_MODE=full");
  });

  it("fails fast when production enables unsafe tooling", () => {
    // ACT & ASSERT
    expect(() =>
      createAppConfig({
        APP_ENV: "production",
        ENCRYPTION_MODE: "full",
        DEVTOOLS_ENABLED: "true",
      }),
    ).toThrow("production requires DEVTOOLS_ENABLED=false");
  });
});
