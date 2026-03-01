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
          // Packages needed for Suite 8/9 tRPC tests
          "@api/console",
          "@vercel/related-projects",
          "@repo/console-api-key",
          "@repo/console-octokit-github",
          "@sentry/core",
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
      "@connections/cache": resolve(root, "apps/connections/src/lib/cache.ts"),
      "@repo/lib": resolve(root, "packages/lib/src/index.ts"),
      "@gateway/cache": resolve(root, "apps/gateway/src/lib/cache.ts"),
      "@gateway/webhook-delivery": resolve(root, "apps/gateway/src/workflows/webhook-delivery.ts"),
      "@backfill/orchestrator": resolve(root, "apps/backfill/src/workflows/backfill-orchestrator.ts"),
      "@backfill/entity-worker": resolve(root, "apps/backfill/src/workflows/entity-worker.ts"),
      // ── Connections providers — allows vi.mock('@connections/providers') to intercept ──
      "@connections/providers": resolve(root, "apps/connections/src/providers/index.ts"),
      // ── server-only stub — Next.js package not available in Node.js test environment ──
      "server-only": resolve(__dirname, "src/__stubs__/server-only.ts"),
      // ── api/console tRPC infrastructure — for Suite 8/9 tRPC caller tests ──
      "@console/trpc": resolve(root, "api/console/src/trpc.ts"),
      "@console/env": resolve(root, "api/console/src/env.ts"),
      "@console/router/org/connections": resolve(root, "api/console/src/router/org/connections.ts"),
      // ── GitHub octokit package — sub-exports listed FIRST (more specific aliases must precede root) ──
      "@repo/console-octokit-github/env": resolve(root, "packages/console-octokit-github/src/env.ts"),
      "@repo/console-octokit-github/oauth-env": resolve(root, "packages/console-octokit-github/src/oauth-env.ts"),
      "@repo/console-octokit-github": resolve(root, "packages/console-octokit-github/src/index.ts"),
    },
  },
});
