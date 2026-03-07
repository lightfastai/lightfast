import type { BackfillConfig } from "@repo/console-backfill";
import { getConnector } from "@repo/console-backfill";
import { createGatewayClient, createRelayClient } from "@repo/gateway-service-clients";
import { NonRetriableError } from "@vendor/inngest";

import { env } from "../env.js";
import { inngest } from "../inngest/client.js";
import { GITHUB_RATE_LIMIT_BUDGET } from "../lib/constants.js";

export const backfillEntityWorker = inngest.createFunction(
  {
    id: "apps-backfill/entity.worker",
    name: "Backfill Entity Worker",
    retries: 3,
    concurrency: [
      // Per-org: max 5 entity workers per organization
      // (one org with multiple connections shares this budget)
      { limit: 5, key: "event.data.orgId" },
      // Global: max 10 entity workers across all orgs
      // (~20 concurrent steps for backfill, leaves ~80 for observation.capture + live webhooks)
      { limit: 10 },
    ],
    throttle: {
      limit: GITHUB_RATE_LIMIT_BUDGET,
      period: "1h",
      key: "event.data.installationId",
    },
    // Workers must declare their own cancelOn — it does NOT propagate from parent
    cancelOn: [
      {
        event: "apps-backfill/run.cancelled",
        match: "data.installationId",
      },
    ],
    timeouts: { start: "5m", finish: "2h" },
  },
  { event: "apps-backfill/entity.requested" },
  async ({ event, step }) => {
    const {
      installationId,
      provider,
      orgId,
      entityType,
      resource,
      since,
      holdForReplay,
      correlationId,
    } = event.data;

    const gw = createGatewayClient({ apiKey: env.GATEWAY_API_KEY, correlationId, requestSource: "backfill" });

    // ── Fetch token outside step boundary ──
    // Tokens must NOT be persisted in Inngest state (step return values are memoized).
    // Fetching outside step.run() means this re-executes on replay (always fresh).
    const { accessToken: initialToken } = await gw.getToken(installationId);

    // ── Resolve connector ──
    const connector = getConnector(
      provider as Parameters<typeof getConnector>[0],
    );
    if (!connector) {
      throw new NonRetriableError(
        `No backfill connector for provider: ${provider}`,
      );
    }

    // Build config with singular resource
    const config: BackfillConfig = {
      installationId,
      provider: provider as BackfillConfig["provider"],
      since,
      accessToken: initialToken,
      resource: {
        providerResourceId: resource.providerResourceId,
        resourceName: resource.resourceName,
      },
    };

    const relay = createRelayClient({ apiKey: env.GATEWAY_API_KEY, correlationId, requestSource: "backfill" });

    // ── Pagination loop ──
    let cursor: unknown = null;
    let pageNum = 1;
    let eventsProduced = 0;
    let eventsDispatched = 0;

    while (true) {
      // Fetch page — includes inline 401 token refresh
      const fetchResult = await step.run(
        `fetch-${entityType}-p${pageNum}`,
        async () => {
          try {
            const page = await connector.fetchPage(config, entityType, cursor);
            return {
              events: page.events,
              nextCursor: page.nextCursor,
              rawCount: page.rawCount,
              tokenRefreshed: false,
              rateLimit: page.rateLimit
                ? {
                    remaining: page.rateLimit.remaining,
                    resetAt: page.rateLimit.resetAt.toISOString(),
                    limit: page.rateLimit.limit,
                  }
                : null,
            };
          } catch (err: unknown) {
            // Token expired — refresh and retry within the same step boundary
            // This avoids memoization issues (the step either succeeds or throws)
            const status =
              err instanceof Error && "status" in err
                ? (err as { status: number }).status
                : undefined;
            if (status === 401) {
              const { accessToken: freshToken } = await gw.getToken(installationId);
              const refreshedConfig = { ...config, accessToken: freshToken };
              const page = await connector.fetchPage(
                refreshedConfig,
                entityType,
                cursor,
              );
              return {
                events: page.events,
                nextCursor: page.nextCursor,
                rawCount: page.rawCount,
                tokenRefreshed: true,
                rateLimit: page.rateLimit
                  ? {
                      remaining: page.rateLimit.remaining,
                      resetAt: page.rateLimit.resetAt.toISOString(),
                      limit: page.rateLimit.limit,
                    }
                  : null,
              };
            }
            throw err;
          }
        },
      );

      // If token was refreshed inside the step, re-fetch outside step boundary
      // so the fresh token is NOT persisted in Inngest state
      if (fetchResult.tokenRefreshed) {
        const { accessToken: freshToken } = await gw.getToken(installationId);
        config.accessToken = freshToken;
      }

      eventsProduced += fetchResult.rawCount;

      // Dispatch each event to Relay service
      // Return count from step so it survives memoized replay (callbacks are skipped on retry)
      const dispatched = await step.run(`dispatch-${entityType}-p${pageNum}`, async () => {
        const BATCH_SIZE = 5;
        const events = fetchResult.events;
        let count = 0;

        for (let i = 0; i < events.length; i += BATCH_SIZE) {
          const batch = events.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map((webhookEvent) =>
              relay.dispatchWebhook(
                provider,
                {
                  connectionId: installationId,
                  orgId,
                  deliveryId: webhookEvent.deliveryId,
                  eventType: webhookEvent.eventType,
                  payload: webhookEvent.payload,
                  receivedAt: Date.now(),
                },
                holdForReplay,
              ),
            ),
          );
          count += batch.length;
        }
        return count;
      });
      eventsDispatched += dispatched;

      // Rate limit sleep if near threshold (dynamic, based on response headers)
      if (
        fetchResult.rateLimit &&
        fetchResult.rateLimit.remaining < fetchResult.rateLimit.limit * 0.1
      ) {
        const resetAt = new Date(fetchResult.rateLimit.resetAt);
        const sleepMs = Math.max(0, resetAt.getTime() - Date.now());
        if (sleepMs > 0) {
          await step.sleep(
            `rate-limit-${entityType}-p${pageNum}`,
            `${Math.ceil(sleepMs / 1000)}s`,
          );
        }
      }

      if (!fetchResult.nextCursor) {
        break;
      }
      cursor = fetchResult.nextCursor;
      pageNum++;
    }

    return {
      entityType,
      resource: resource.providerResourceId,
      eventsProduced,
      eventsDispatched,
      pagesProcessed: pageNum,
    };
  },
);
