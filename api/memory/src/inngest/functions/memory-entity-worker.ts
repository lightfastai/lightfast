/**
 * Memory backfill entity worker
 *
 * Ported from apps/backfill/src/workflows/entity-worker.ts
 *
 * KEY CHANGES vs backfill service:
 * - Function ID: memory/backfill.entity-worker (was backfill/entity.worker)
 * - Trigger: memory/backfill.entity.requested (was backfill/entity.requested)
 * - cancelOn: memory/backfill.run.cancelled (was backfill/run.cancelled)
 * - Replace gw.executeApi() with direct provider API calls using
 *   getActiveTokenForInstallation() + forceRefreshToken() + direct fetch()
 * - Replace relay.dispatchWebhook() with step.sendEvent("memory/webhook.received")
 * - 401 health check signal uses memory/health.check.requested
 */

import { type BackfillContext, getProvider } from "@repo/console-providers";
import type { ProviderApi, ProviderDefinition } from "@repo/console-providers";
import { db } from "@db/console/client";
import { gatewayInstallations } from "@db/console/schema";
import { NonRetriableError } from "@repo/inngest";
import { eq } from "@vendor/db";
import { log } from "@vendor/observability/log/next";
import { inngest } from "../client";
import { providerConfigs } from "../../lib/provider-configs";
import {
  forceRefreshToken,
  getActiveTokenForInstallation,
} from "../../lib/token-helpers";
import { GITHUB_RATE_LIMIT_BUDGET, MAX_PAGES } from "../../lib/constants";

export const memoryEntityWorker = inngest.createFunction(
  {
    id: "memory/backfill.entity-worker",
    name: "Memory Backfill Entity Worker",
    retries: 3,
    concurrency: [
      // Per-org: max 5 entity workers per organization
      // (one org with multiple connections shares this budget)
      { limit: 5, key: "event.data.orgId" },
      // Global: max 10 entity workers across all orgs
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
        event: "memory/backfill.run.cancelled",
        match: "data.installationId",
      },
    ],
    timeouts: { start: "5m", finish: "2h" },
  },
  { event: "memory/backfill.entity.requested" },
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

    log.info("[entity-worker] starting", {
      installationId,
      provider,
      entityType,
      resource: resource.providerResourceId,
      since,
      correlationId,
    });

    // ── Resolve provider ──
    const providerDef = getProvider(provider);
    if (!providerDef) {
      throw new NonRetriableError(`Unknown provider: ${provider}`);
    }
    if (!providerDef.backfill) {
      throw new NonRetriableError(
        `Provider "${provider}" does not support backfill`
      );
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

    // ── Pagination loop ──
    let cursor: unknown = null;
    let pageNum = 1;
    let eventsProduced = 0;
    let eventsDispatched = 0;

    while (true) {
      const fetchResult = await step.run(
        `fetch-${entityType}-p${pageNum}`,
        async () => {
          // Get installation for token resolution
          const installationRows = await db
            .select()
            .from(gatewayInstallations)
            .where(eq(gatewayInstallations.id, installationId))
            .limit(1);

          const installation = installationRows[0];
          if (!installation) {
            throw new NonRetriableError(
              `Installation not found: ${installationId}`
            );
          }
          if (installation.status !== "active") {
            throw new NonRetriableError(
              `Installation not active: ${installationId} (status: ${installation.status})`
            );
          }

          const config = providerConfigs[provider];

          // Get active token
          let token: string;
          try {
            ({ token } = await getActiveTokenForInstallation(
              installation,
              config,
              providerDef as ProviderDefinition
            ));
          } catch (err) {
            throw new NonRetriableError(
              `Failed to get token for installation ${installationId}: ${err instanceof Error ? err.message : String(err)}`
            );
          }

          // Build the API request from the entity handler
          const request = entityHandler.buildRequest(ctx, cursor);
          const api: ProviderApi = providerDef.api;
          const endpoint = api.endpoints[entityHandler.endpointId];
          if (!endpoint) {
            throw new NonRetriableError(
              `Unknown endpoint: ${entityHandler.endpointId}`
            );
          }

          // Build URL
          let path = endpoint.path;
          if (request.pathParams) {
            for (const [key, val] of Object.entries(request.pathParams)) {
              path = path.replace(`{${key}}`, encodeURIComponent(val));
            }
          }

          let url = `${api.baseUrl}${path}`;
          if (
            request.queryParams &&
            Object.keys(request.queryParams).length > 0
          ) {
            url += `?${new URLSearchParams(request.queryParams).toString()}`;
          }

          // Build headers
          const authHeader = api.buildAuthHeader
            ? api.buildAuthHeader(token)
            : `Bearer ${token}`;

          const headers: Record<string, string> = {
            Authorization: authHeader,
            ...(api.defaultHeaders ?? {}),
          };

          const fetchOptions: RequestInit = {
            method: endpoint.method,
            headers,
            signal: AbortSignal.timeout(endpoint.timeout ?? 30_000),
          };

          if (request.body) {
            fetchOptions.body = JSON.stringify(request.body);
            headers["Content-Type"] = "application/json";
          }

          // Execute request
          let response = await fetch(url, fetchOptions);

          // 401 retry with force-refresh
          if (response.status === 401) {
            const freshToken = await forceRefreshToken(
              installation,
              config,
              providerDef as ProviderDefinition
            );
            if (freshToken && freshToken !== token) {
              headers.Authorization = api.buildAuthHeader
                ? api.buildAuthHeader(freshToken)
                : `Bearer ${freshToken}`;
              response = await fetch(url, { ...fetchOptions, headers });
            }
          }

          if (response.status === 401) {
            // Token is definitively revoked — fire health-check signal
            return {
              __healthCheckSignal: true as const,
              status: 401,
              events: [] as ReturnType<
                typeof entityHandler.processResponse
              >["events"],
              nextCursor: null,
              rawCount: 0,
              rateLimit: null,
            };
          }

          if (response.status === 403) {
            throw new NonRetriableError(
              `Provider API returned 403 — insufficient scope for installation ${installationId}`
            );
          }

          if (response.status !== 200) {
            throw new Error(
              `Provider API returned ${response.status}`
            );
          }

          const data = await response.json();
          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });

          const processed = entityHandler.processResponse(
            data,
            ctx,
            cursor,
            responseHeaders
          );

          // Parse rate limits client-side from raw headers
          const rateLimit = providerDef.api.parseRateLimit(
            new Headers(responseHeaders)
          );

          return {
            __healthCheckSignal: false as const,
            status: 200,
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

      // Handle 401 health check signal outside of the step
      if (fetchResult.__healthCheckSignal) {
        await step.sendEvent("signal-connection-health-check", {
          name: "memory/health.check.requested",
          data: {
            installationId,
            provider,
            reason: "401_unauthorized" as const,
            correlationId,
          },
        });
        throw new NonRetriableError(
          `Provider API returned 401 — token revoked for installation ${installationId}. Health check signal sent.`
        );
      }

      log.info("[entity-worker] page fetched", {
        installationId,
        entityType,
        resource: resource.providerResourceId,
        page: pageNum,
        events: fetchResult.events.length,
        ...(fetchResult.rateLimit && {
          rateLimitRemaining: fetchResult.rateLimit.remaining,
        }),
        correlationId,
      });

      eventsProduced += fetchResult.events.length;

      // Dispatch each event as memory/webhook.received via step.sendEvent
      const dispatched = await step.run(
        `dispatch-${entityType}-p${pageNum}`,
        async () => {
          const BATCH_SIZE = 5;
          const events = fetchResult.events;
          let count = 0;

          for (let i = 0; i < events.length; i += BATCH_SIZE) {
            const batch = events.slice(i, i + BATCH_SIZE);
            // Send events to Inngest instead of relay HTTP dispatch
            if (batch.length > 0) {
              await inngest.send(
                batch.map((webhookEvent) => ({
                  name: "memory/webhook.received" as const,
                  data: {
                    provider,
                    deliveryId: webhookEvent.deliveryId,
                    eventType: webhookEvent.eventType,
                    resourceId: null,
                    payload: webhookEvent.payload,
                    receivedAt: Date.now(),
                    preResolved: {
                      connectionId: installationId,
                      orgId,
                    },
                    correlationId,
                  },
                }))
              );
            }
            count += batch.length;
          }
          return count;
        }
      );

      log.info("[entity-worker] page dispatched", {
        installationId,
        entityType,
        resource: resource.providerResourceId,
        page: pageNum,
        dispatched,
        correlationId,
      });

      eventsDispatched += dispatched;

      // Rate limit sleep if near threshold (dynamic, based on response headers)
      if (fetchResult.rateLimit) {
        const { remaining, resetAt, limit } = fetchResult.rateLimit;
        if (remaining < limit * 0.1) {
          const sleepMs = Math.max(0, new Date(resetAt).getTime() - Date.now());
          if (sleepMs > 0) {
            log.info("[entity-worker] rate limit sleep", {
              installationId,
              entityType,
              resource: resource.providerResourceId,
              sleepMs,
              resetAt,
              correlationId,
            });
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
      if (pageNum >= MAX_PAGES) {
        log.warn(`[backfill] entity-worker hit MAX_PAGES cap (${MAX_PAGES})`, {
          installationId,
          entityType,
          resource: resource.providerResourceId,
          correlationId,
        });
        break;
      }
      cursor = fetchResult.nextCursor;
      pageNum++;
    }

    log.info("[entity-worker] complete", {
      installationId,
      provider,
      entityType,
      resource: resource.providerResourceId,
      eventsProduced,
      eventsDispatched,
      pagesProcessed: pageNum,
      correlationId,
    });

    return {
      entityType,
      resource: resource.providerResourceId,
      eventsProduced,
      eventsDispatched,
      pagesProcessed: pageNum,
    };
  }
);
