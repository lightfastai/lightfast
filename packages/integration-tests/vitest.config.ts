import { resolve } from "path";
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

const root = resolve(__dirname, "../..");

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
      setupFiles: ["./src/setup.ts"],
      server: {
        deps: {
          inline: [
            "@lightfast/connections",
            "@lightfast/backfill",
            "@lightfast/gateway",
            "@vendor/upstash",
            "@vendor/qstash",
            "@vendor/inngest",
            "@vendor/related-projects",
            "@vendor/upstash-workflow",
            "@db/console",
            "@repo/console-backfill",
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
        "@connections/app": resolve(root, "apps/connections/src/app.ts"),
        "@backfill/app": resolve(root, "apps/backfill/src/app.ts"),
        "@gateway/app": resolve(root, "apps/gateway/src/app.ts"),
        "@connections/urls": resolve(root, "apps/connections/src/lib/urls.ts"),
        "@connections/cache": resolve(root, "apps/connections/src/lib/cache.ts"),
        "@repo/lib": resolve(root, "packages/lib/src/index.ts"),
        "@gateway/cache": resolve(root, "apps/gateway/src/lib/cache.ts"),
        "@gateway/webhook-delivery": resolve(root, "apps/gateway/src/workflows/webhook-delivery.ts"),
        "@backfill/orchestrator": resolve(root, "apps/backfill/src/workflows/backfill-orchestrator.ts"),
        "@backfill/entity-worker": resolve(root, "apps/backfill/src/workflows/entity-worker.ts"),
        "@connections/providers": resolve(root, "apps/connections/src/providers/index.ts"),
        "server-only": resolve(__dirname, "src/__stubs__/server-only.ts"),
        "@console/trpc": resolve(root, "api/console/src/trpc.ts"),
        "@console/env": resolve(root, "api/console/src/env.ts"),
        "@console/router/org/connections": resolve(root, "api/console/src/router/org/connections.ts"),
        "@repo/console-octokit-github/env": resolve(root, "packages/console-octokit-github/src/env.ts"),
        "@repo/console-octokit-github/oauth-env": resolve(root, "packages/console-octokit-github/src/oauth-env.ts"),
        "@repo/console-octokit-github": resolve(root, "packages/console-octokit-github/src/index.ts"),
      },
    },
  }),
);
