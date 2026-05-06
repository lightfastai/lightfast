import { defineConfig } from "vite";

export default defineConfig({
  define: {
    __SENTRY_DSN__: JSON.stringify(process.env.SENTRY_DSN ?? ""),
  },
  build: {
    // Required for Sentry stack-trace symbolication. Sourcemaps land in
    // .vite/build/ alongside the bundles and are uploaded to Sentry by
    // scripts/upload-sourcemaps.mjs. rewriteFramesIntegration in src/main/sentry.ts
    // binds runtime frames (`app:///bootstrap.js`) to these maps.
    sourcemap: true,
    lib: {
      entry: "src/main/bootstrap.ts",
      formats: ["cjs"],
      fileName: () => "bootstrap.js",
    },
    rollupOptions: {
      external: ["electron"],
    },
  },
});
