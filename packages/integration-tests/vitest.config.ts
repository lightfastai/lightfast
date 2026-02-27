import { defineConfig } from "vitest/config";
import { resolve } from "path";

const root = resolve(__dirname, "../..");

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/setup.ts"],
    // Process app + vendor packages through Vite so vi.mock factories intercept correctly
    server: {
      deps: {
        inline: [
          // App packages (TypeScript source)
          "@lightfast/connections",
          "@lightfast/backfill",
          "@lightfast/gateway",
          // Vendor packages — must be inlined for vi.mock to intercept their usage in apps
          "@vendor/upstash",
          "@vendor/qstash",
          "@vendor/inngest",
          "@vendor/related-projects",
          "@vendor/upstash-workflow",
          // DB packages — inline so @db/console/client mock resolves correctly
          "@db/console",
          // Shared packages imported by app workflows — inline so vi.mock intercepts
          "@repo/console-backfill",
        ],
      },
    },
  },
  resolve: {
    alias: {
      // ── App entry points ──
      "@connections/app": resolve(root, "apps/connections/src/app.ts"),
      "@backfill/app": resolve(root, "apps/backfill/src/app.ts"),
      "@gateway/app": resolve(root, "apps/gateway/src/app.ts"),
      // ── Deep imports — bypasses package `exports` enforcement ──
      "@connections/urls": resolve(root, "apps/connections/src/lib/urls.ts"),
      "@connections/crypto": resolve(root, "apps/connections/src/lib/crypto.ts"),
      "@connections/cache": resolve(root, "apps/connections/src/lib/cache.ts"),
      "@gateway/cache": resolve(root, "apps/gateway/src/lib/cache.ts"),
      "@gateway/webhook-delivery": resolve(root, "apps/gateway/src/workflows/webhook-delivery.ts"),
      "@backfill/orchestrator": resolve(root, "apps/backfill/src/workflows/backfill-orchestrator.ts"),
      "@backfill/entity-worker": resolve(root, "apps/backfill/src/workflows/entity-worker.ts"),
    },
  },
});
