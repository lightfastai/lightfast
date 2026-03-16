import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "env/sentry-env": "src/env/sentry-env.ts",
    "env/betterstack-env": "src/env/betterstack-env.ts",
    sentry: "src/sentry.ts",
    log: "src/log.ts",
    "client-log": "src/client-log.ts",
    types: "src/types.ts",
    error: "src/error.ts",
    "async-executor": "src/async-executor.ts",
    "error-formatter": "src/error-formatter.ts",
    "use-logger": "src/use-logger.ts",
    "service-log": "src/service-log.ts",
    "print-routes": "src/print-routes.ts",
  },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
});
