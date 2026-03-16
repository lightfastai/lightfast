import { resolve } from "node:path";
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

const root = resolve(import.meta.dirname, "../..");

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
            "@lightfast/gateway",
            "@lightfast/backfill",
            "@lightfast/relay",
            "@vendor/upstash",
            "@vendor/qstash",
            "@vendor/inngest",
            "@vendor/related-projects",
            "@vendor/upstash-workflow",
            "@db/console",
            "@api/console",
            "@vercel/related-projects",
            "@repo/console-api-key",
            "@repo/console-octokit-github",
            "@repo/console-pinecone",
            "@repo/console-embed",
            "@vendor/knock",
            "@vendor/embed",
            "@repo/console-providers",
            "@repo/console-validation",
          ],
        },
      },
    },
    resolve: {
      alias: {
        "@gateway/app": resolve(root, "apps/gateway/src/app.ts"),
        "@backfill/app": resolve(root, "apps/backfill/src/app.ts"),
        "@relay/app": resolve(root, "apps/relay/src/app.ts"),
        "@gateway/urls": resolve(root, "apps/gateway/src/lib/urls.ts"),
        "@gateway/cache": resolve(root, "apps/gateway/src/lib/cache.ts"),
        "@repo/lib": resolve(root, "packages/lib/src"),
        "@relay/cache": resolve(root, "apps/relay/src/lib/cache.ts"),
        "@relay/webhook-delivery": resolve(
          root,
          "apps/relay/src/workflows/webhook-delivery.ts"
        ),
        "@backfill/orchestrator": resolve(
          root,
          "apps/backfill/src/workflows/backfill-orchestrator.ts"
        ),
        "@backfill/entity-worker": resolve(
          root,
          "apps/backfill/src/workflows/entity-worker.ts"
        ),
        "@gateway/providers": resolve(
          root,
          "apps/gateway/src/providers/index.ts"
        ),
        "@sentry/core": resolve(
          import.meta.dirname,
          "src/__stubs__/sentry-core.ts"
        ),
        "@repo/gateway-service-clients": resolve(
          import.meta.dirname,
          "src/__stubs__/gateway-service-clients.ts"
        ),
        "server-only": resolve(
          import.meta.dirname,
          "src/__stubs__/server-only.ts"
        ),
        "@console/trpc": resolve(root, "api/console/src/trpc.ts"),
        "@console/env": resolve(root, "api/console/src/env.ts"),
        "@console/router/org/connections": resolve(
          root,
          "api/console/src/router/org/connections.ts"
        ),
        "@console/neural": resolve(
          root,
          "api/console/src/inngest/workflow/neural/index.ts"
        ),
        "@console/inngest-client": resolve(
          root,
          "api/console/src/inngest/client/client.ts"
        ),
        "@repo/console-octokit-github/env": resolve(
          root,
          "packages/console-octokit-github/src/env.ts"
        ),
        "@repo/console-octokit-github": resolve(
          root,
          "packages/console-octokit-github/src/index.ts"
        ),
      },
    },
  })
);
