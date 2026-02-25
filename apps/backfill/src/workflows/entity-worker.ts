import { NonRetriableError } from "inngest";
import { inngest } from "../inngest/client";
import { getConnector } from "@repo/console-backfill";
import type { BackfillConfig } from "@repo/console-backfill";
import { env } from "../env";
import { gatewayUrl, connectionsUrl } from "../lib/related-projects";

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
    // Conservative backstop: 4000 req/hr per installation token
    // (GitHub limit is 5000 — leaves 1000 for webhook/realtime traffic)
    throttle: {
      limit: 4000,
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
    // Emit failure completion so orchestrator's waitForEvent resolves immediately
    // instead of waiting 4h for a timeout
    onFailure: async ({ error, event, step }) => {
      const originalData = event.data.event.data;
      await step.sendEvent("notify-failure", {
        name: "apps-backfill/entity.completed",
        data: {
          installationId: originalData.installationId,
          provider: originalData.provider,
          entityType: originalData.entityType,
          resourceId: originalData.resource.providerResourceId,
          success: false,
          eventsProduced: 0,
          eventsDispatched: 0,
          pagesProcessed: 0,
          error: error.message,
        },
      });
    },
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
    } = event.data;

    // ── Step 1: Self-fetch token (not passed via event — security + expiration) ──
    const { accessToken: initialToken } = await step.run(
      "get-token",
      async () => {
        const response = await fetch(
          `${connectionsUrl}/connections/${installationId}/token`,
          { headers: { "X-API-Key": env.GATEWAY_API_KEY } },
        );
        if (!response.ok) {
          throw new Error(
            `Gateway getToken failed: ${response.status} for ${installationId}`,
          );
        }
        return response.json() as Promise<{
          accessToken: string;
          provider: string;
          expiresIn: number | null;
        }>;
      },
    );

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
              const tokenResponse = await fetch(
                `${connectionsUrl}/connections/${installationId}/token`,
                { headers: { "X-API-Key": env.GATEWAY_API_KEY } },
              );
              if (!tokenResponse.ok) throw err; // Can't refresh — rethrow original
              const { accessToken: freshToken } =
                (await tokenResponse.json()) as { accessToken: string };
              config.accessToken = freshToken;

              const page = await connector.fetchPage(
                config,
                entityType,
                cursor,
              );
              return {
                events: page.events,
                nextCursor: page.nextCursor,
                rawCount: page.rawCount,
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

      eventsProduced += fetchResult.rawCount;

      // Dispatch each event to Gateway service auth endpoint
      // Return count from step so it survives memoized replay (callbacks are skipped on retry)
      const dispatched = await step.run(`dispatch-${entityType}-p${pageNum}`, async () => {
        let count = 0;
        for (const webhookEvent of fetchResult.events) {
          const response = await fetch(`${gatewayUrl}/webhooks/${provider}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": env.GATEWAY_API_KEY,
            },
            body: JSON.stringify({
              connectionId: installationId,
              orgId,
              deliveryId: webhookEvent.deliveryId,
              eventType: webhookEvent.eventType,
              payload: webhookEvent.payload,
              receivedAt: Date.now(),
            }),
          });
          if (!response.ok) {
            const text = await response.text().catch(() => "unknown");
            throw new Error(
              `Gateway ingestWebhook failed: ${response.status} — ${text}`,
            );
          }
          count++;
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

      if (!fetchResult.nextCursor) break;
      cursor = fetchResult.nextCursor;
      pageNum++;
    }

    // ── Emit completion event (always — orchestrator's waitForEvent depends on this) ──
    await step.sendEvent("notify-completion", {
      name: "apps-backfill/entity.completed",
      data: {
        installationId,
        provider,
        entityType,
        resourceId: resource.providerResourceId,
        success: true,
        eventsProduced,
        eventsDispatched,
        pagesProcessed: pageNum,
      },
    });

    return {
      entityType,
      resource: resource.providerResourceId,
      eventsProduced,
      eventsDispatched,
      pagesProcessed: pageNum,
    };
  },
);
