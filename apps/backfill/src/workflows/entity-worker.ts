import { type BackfillContext, getProvider } from "@repo/console-providers";
import {
  createGatewayClient,
  createRelayClient,
  HttpError,
} from "@repo/gateway-service-clients";
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
      // (~20 concurrent steps for backfill, leaves ~80 for event.capture + live webhooks)
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

    const gw = createGatewayClient({
      apiKey: env.GATEWAY_API_KEY,
      correlationId,
      requestSource: "backfill",
    });

    // ── Resolve provider ──
    const providerDef = getProvider(provider);
    if (!providerDef) {
      throw new NonRetriableError(`Unknown provider: ${provider}`);
    }

    const entityHandler = providerDef.backfill.entityTypes[entityType];
    if (!entityHandler) {
      throw new NonRetriableError(
        `Entity type "${entityType}" is not supported for ${provider} backfill`
      );
    }

    const ctx: BackfillContext = {
      installationId,
      resource: {
        providerResourceId: resource.providerResourceId,
        resourceName: resource.resourceName,
      },
      since,
    };

    const relay = createRelayClient({
      apiKey: env.GATEWAY_API_KEY,
      correlationId,
      requestSource: "backfill",
    });

    // ── Pagination loop ──
    let cursor: unknown = null;
    let pageNum = 1;
    let eventsProduced = 0;
    let eventsDispatched = 0;

    while (true) {
      const fetchResult = await step.run(
        `fetch-${entityType}-p${pageNum}`,
        async () => {
          const request = entityHandler.buildRequest(ctx, cursor);
          const raw = await gw.executeApi(installationId, {
            endpointId: entityHandler.endpointId,
            ...request,
          });

          if (raw.status !== 200) {
            throw new HttpError(
              `Provider API returned ${raw.status}`,
              raw.status
            );
          }

          const processed = entityHandler.processResponse(
            raw.data,
            ctx,
            cursor,
            raw.headers
          );

          // Parse rate limits client-side from raw headers
          const rateLimit = providerDef.api.parseRateLimit(
            new Headers(raw.headers)
          );

          return {
            events: processed.events,
            nextCursor: processed.nextCursor,
            rawCount: processed.rawCount,
            rateLimit: rateLimit
              ? {
                  remaining: rateLimit.remaining,
                  resetAt: rateLimit.resetAt.toISOString(),
                  limit: rateLimit.limit,
                }
              : null,
          };
        }
      );

      eventsProduced += fetchResult.rawCount;

      // Dispatch each event to Relay service
      // Return count from step so it survives memoized replay (callbacks are skipped on retry)
      const dispatched = await step.run(
        `dispatch-${entityType}-p${pageNum}`,
        async () => {
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
                  holdForReplay
                )
              )
            );
            count += batch.length;
          }
          return count;
        }
      );
      eventsDispatched += dispatched;

      // Rate limit sleep if near threshold (dynamic, based on response headers)
      if (fetchResult.rateLimit) {
        const { remaining, resetAt, limit } = fetchResult.rateLimit;
        if (remaining < limit * 0.1) {
          const sleepMs = Math.max(0, new Date(resetAt).getTime() - Date.now());
          if (sleepMs > 0) {
            await step.sleep(
              `rate-limit-${entityType}-p${pageNum}`,
              `${Math.ceil(sleepMs / 1000)}s`
            );
          }
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
  }
);
