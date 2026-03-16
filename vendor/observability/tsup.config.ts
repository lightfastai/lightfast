import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "env/sentry-env": "src/env/sentry-env.ts",
    "env/betterstack": "src/env/betterstack.ts",
    "env/betterstack-edge": "src/env/betterstack-edge.ts",
    "log/next": "src/log/next.ts",
    "log/edge": "src/log/edge.ts",
    "log/types": "src/log/types.ts",
    sentry: "src/sentry.ts",
    "error/next": "src/error/next.ts",
    "error/edge": "src/error/edge.ts",
    "print-routes": "src/print-routes.ts",
  },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
});
