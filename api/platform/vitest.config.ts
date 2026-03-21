import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    resolve: {
      alias: {
        // Stub server-only so tests don't throw "This module cannot be imported from a Client Component module"
        "server-only": new URL(
          "./src/__mocks__/server-only.ts",
          import.meta.url
        ).pathname,
      },
    },
    test: {
      globals: true,
      environment: "node",
      env: {
        SKIP_ENV_VALIDATION: "1",
        SERVICE_JWT_SECRET:
          "test-service-jwt-secret-for-vitest-at-least-32-chars",
        ENCRYPTION_KEY: "test-encryption-key-for-vitest-at-least-32-chars!!",
      },
    },
  })
);
