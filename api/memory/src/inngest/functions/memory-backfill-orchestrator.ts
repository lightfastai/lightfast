/**
 * Memory backfill orchestrator
 *
 * Ported from apps/backfill/src/workflows/backfill-orchestrator.ts
 *
 * KEY CHANGES vs backfill service:
 * - Function ID: memory/backfill.orchestrator (was backfill/run.orchestrator)
 * - Trigger: memory/backfill.run.requested (was backfill/run.requested)
 * - cancelOn: memory/backfill.run.cancelled (was backfill/run.cancelled)
 * - Replace createGatewayClient() HTTP calls with direct DB queries
 * - Replace relay.replayCatchup() with direct DB query + inngest.send("memory/webhook.received")
 * - step.invoke() references memoryEntityWorker
 */

import { db } from "@db/console/client";
import {
  gatewayBackfillRuns,
  gatewayInstallations,
  gatewayResources,
  gatewayWebhookDeliveries,
} from "@db/console/schema";
import { getProvider } from "@repo/console-providers";
import type { ProviderSlug } from "@repo/console-providers";
import {
  BACKFILL_TERMINAL_STATUSES,
} from "@repo/console-providers/contracts";
import { NonRetriableError } from "@repo/inngest";
import { and, eq, notInArray } from "@vendor/db";
import { log } from "@vendor/observability/log/next";
import { inngest } from "../client";
import { memoryEntityWorker } from "./memory-entity-worker";

export const memoryBackfillOrchestrator = inngest.createFunction(
  {
    id: "memory/backfill.orchestrator",
    name: "Memory Backfill Orchestrator",
    retries: 3,
    concurrency: [
      // 1 backfill per connection — prevents duplicate backfills
      { limit: 1, key: "event.data.installationId" },
      // 10 total concurrent orchestrators (each lightweight — just fan-out + wait)
      { limit: 10 },
    ],
    cancelOn: [
      {
        event: "memory/backfill.run.cancelled",
        match: "data.installationId",
      },
    ],
    // Orchestrator waits for all entity workers — must accommodate the longest
    // Worst case: 15 work units (5 repos x 3 entities), 5 concurrent, each 2hr
    // = 15/5 * 2hr = 6hr total. Set to 8hr for safety.
    timeouts: { start: "2m", finish: "8h" },
  },
  { event: "memory/backfill.run.requested" },
  async ({ event, step }) => {
    const {
      installationId,
      provider,
      orgId,
      depth,
      entityTypes,
      holdForReplay,
      correlationId,
    } = event.data;

    log.info("[backfill-orchestrator] starting", {
      installationId,
      provider,
      depth,
      entityTypes,
      correlationId,
    });

    if (depth <= 0) {
      throw new NonRetriableError(
        `Invalid depth: ${depth} — must be a positive number of days`
      );
    }

    // ── Step 1: Fetch connection details from DB (replaces gateway HTTP call) ──
    const connection = await step.run("get-connection", async () => {
      const installationRows = await db
        .select()
        .from(gatewayInstallations)
        .where(eq(gatewayInstallations.id, installationId))
        .limit(1);

      const conn = installationRows[0];
      if (!conn) {
        throw new NonRetriableError(
          `Connection not found: ${installationId}`
        );
      }
      if (conn.status !== "active") {
        throw new NonRetriableError(
          `Connection is not active: ${installationId} (status: ${conn.status})`
        );
      }
      // Tenant isolation: verify caller-supplied orgId matches the DB-canonical value
      if (conn.orgId !== orgId) {
        throw new NonRetriableError(
          `orgId mismatch: event has "${orgId}" but connection belongs to "${conn.orgId}"`
        );
      }

      // Fetch linked resources
      const resources = await db
        .select({
          providerResourceId: gatewayResources.providerResourceId,
          resourceName: gatewayResources.resourceName,
        })
        .from(gatewayResources)
        .where(
          and(
            eq(gatewayResources.installationId, installationId),
            eq(gatewayResources.status, "active")
          )
        );

      return {
        id: conn.id,
        provider: conn.provider,
        orgId: conn.orgId,
        status: conn.status,
        resources,
      };
    });

    log.info("[backfill-orchestrator] connection fetched", {
      installationId,
      provider,
      resourceCount: connection.resources.length,
      correlationId,
    });

    // ── Step 1b: Fetch backfill history from DB (replaces gateway HTTP call) ──
    const backfillHistory = await step.run("get-backfill-history", async () => {
      return db
        .select({
          entityType: gatewayBackfillRuns.entityType,
          providerResourceId: gatewayBackfillRuns.providerResourceId,
          since: gatewayBackfillRuns.since,
        })
        .from(gatewayBackfillRuns)
        .where(
          and(
            eq(gatewayBackfillRuns.installationId, installationId),
            eq(gatewayBackfillRuns.status, "completed")
          )
        );
    });

    // ── Step 2: Resolve entity types and validate provider ──
    const providerDef = getProvider(provider);
    if (!providerDef) {
      throw new NonRetriableError(
        `No backfill provider for provider: ${provider}`
      );
    }
    if (!providerDef.backfill) {
      throw new NonRetriableError(
        `Provider "${provider}" does not support backfill`
      );
    }

    const resolvedEntityTypes =
      entityTypes && entityTypes.length > 0
        ? entityTypes
        : [...providerDef.backfill.defaultEntityTypes];

    // Compute `since` inside a step so it's deterministic across retries/replays
    const since = await step.run("compute-since", () =>
      new Date(Date.now() - depth * 24 * 60 * 60 * 1000).toISOString()
    );

    // ── Step 3: Enumerate work units (resource x entityType) ──
    const workUnits = connection.resources.flatMap((resource) => {
      const resourceName = resource.resourceName;
      if (!resourceName) {
        log.warn("[backfill] skipping resource with null/empty resourceName", {
          installationId,
          providerResourceId: resource.providerResourceId,
          correlationId,
        });
        return [];
      }
      return resolvedEntityTypes.map((entityType: string) => ({
        entityType,
        resource: {
          providerResourceId: resource.providerResourceId,
          resourceName,
        },
        // Stable ID for step naming
        workUnitId: `${resource.providerResourceId}-${entityType}`,
      }));
    });

    // ── Gap-aware filtering: skip (resource, entityType) pairs covered by prior runs ──
    const filteredWorkUnits = workUnits.filter((wu) => {
      const priorRun = backfillHistory.find(
        (h) =>
          h.entityType === wu.entityType &&
          h.providerResourceId === wu.resource.providerResourceId
      );
      if (!priorRun) {
        return true; // No prior run — must fetch
      }
      // Prior run's since ≤ requested since → already covered
      return new Date(priorRun.since) > new Date(since);
    });

    log.info("[backfill-orchestrator] work units planned", {
      installationId,
      provider,
      total: workUnits.length,
      afterFilter: filteredWorkUnits.length,
      skippedByGapFilter: workUnits.length - filteredWorkUnits.length,
      since,
      correlationId,
    });

    if (filteredWorkUnits.length === 0) {
      return {
        success: true,
        installationId,
        provider,
        workUnits: workUnits.length,
        skipped: workUnits.length,
        dispatched: 0,
        eventsProduced: 0,
        eventsDispatched: 0,
      };
    }

    log.info("[backfill-orchestrator] dispatching entity workers", {
      installationId,
      provider,
      count: filteredWorkUnits.length,
      workUnitIds: filteredWorkUnits.map((wu) => wu.workUnitId),
      correlationId,
    });

    // ── Step 4: Invoke entity workers directly ──
    const completionResults = await Promise.all(
      filteredWorkUnits.map(async (wu) => {
        try {
          const result = await step.invoke(`invoke-${wu.workUnitId}`, {
            function: memoryEntityWorker,
            data: {
              installationId,
              provider,
              orgId,
              entityType: wu.entityType,
              resource: wu.resource,
              since,
              depth,
              holdForReplay,
              correlationId,
            },
            timeout: "4h",
          });
          return {
            entityType: wu.entityType,
            resourceId: wu.resource.providerResourceId,
            success: true,
            eventsProduced: result.eventsProduced,
            eventsDispatched: result.eventsDispatched,
            pagesProcessed: result.pagesProcessed,
          };
        } catch (err) {
          return {
            entityType: wu.entityType,
            resourceId: wu.resource.providerResourceId,
            success: false,
            eventsProduced: 0,
            eventsDispatched: 0,
            pagesProcessed: 0,
            error: err instanceof Error ? err.message : "entity worker failed",
          };
        }
      })
    );

    // ── Step 5: Aggregate results ──
    const succeeded = completionResults.filter((r) => r.success);
    const failed = completionResults.filter((r) => !r.success);

    // ── Step 6: Persist run records — one per (resource, entityType) ──
    if (completionResults.length > 0) {
      await step.run("persist-run-records", async () => {
        const now = new Date().toISOString();
        for (const r of completionResults) {
          const isTerminal = true; // All results here are terminal
          const sharedFields = {
            since,
            depth,
            status: r.success ? "completed" : "failed",
            pagesProcessed: r.pagesProcessed,
            eventsProduced: r.eventsProduced,
            eventsDispatched: r.eventsDispatched,
            error: r.success ? null : (r.error ?? null),
            completedAt: now,
            updatedAt: now,
          };

          await db
            .insert(gatewayBackfillRuns)
            .values({
              installationId,
              entityType: r.entityType,
              providerResourceId: r.resourceId,
              ...sharedFields,
              startedAt: now,
            })
            .onConflictDoUpdate({
              target: [
                gatewayBackfillRuns.installationId,
                gatewayBackfillRuns.providerResourceId,
                gatewayBackfillRuns.entityType,
              ],
              set: sharedFields,
            });
        }
      });
    }

    // ── Step 7: Replay held webhooks (replaces relay.replayCatchup) ──
    // When holdForReplay is set, entity workers persist webhooks without delivery.
    // After all workers complete, drain them by querying DB directly and sending
    // memory/webhook.received events so they are processed in chronological order.
    if (holdForReplay && succeeded.length > 0) {
      log.info("[backfill-orchestrator] replaying held webhooks", {
        installationId,
        succeededWorkers: succeeded.length,
        correlationId,
      });
      await step.run("replay-held-webhooks", async () => {
        const BATCH_SIZE = 200;
        const MAX_ITERATIONS = 500; // Safety cap: 500 * 200 = 100k webhooks max
        let iterations = 0;
        let processedIds: string[] = [];

        while (iterations < MAX_ITERATIONS) {
          iterations++;

          // Query un-delivered webhooks for this installation
          const conditions = [
            eq(gatewayWebhookDeliveries.installationId, installationId),
            eq(gatewayWebhookDeliveries.status, "received"),
          ];
          if (processedIds.length > 0) {
            conditions.push(
              notInArray(gatewayWebhookDeliveries.id, processedIds)
            );
          }

          const deliveries = await db
            .select()
            .from(gatewayWebhookDeliveries)
            .where(and(...conditions))
            .orderBy(gatewayWebhookDeliveries.receivedAt)
            .limit(BATCH_SIZE);

          if (deliveries.length === 0) {
            break;
          }

          // Send each delivery as a memory/webhook.received event
          const events = deliveries
            .filter((d) => d.payload)
            .map((d) => ({
              name: "memory/webhook.received" as const,
              data: {
                provider: d.provider,
                deliveryId: d.deliveryId,
                eventType: d.eventType,
                resourceId: null as string | null,
                payload: JSON.parse(d.payload!) as unknown,
                receivedAt: new Date(d.receivedAt).getTime(),
                preResolved: {
                  connectionId: installationId,
                  orgId: connection.orgId,
                },
                correlationId,
              },
            }));

          if (events.length > 0) {
            await inngest.send(events);
          }

          // Track processed IDs to exclude from next batch
          for (const d of deliveries) {
            processedIds.push(d.id);
          }
        }

        if (iterations >= MAX_ITERATIONS) {
          log.error("[backfill] replay-held-webhooks hit iteration cap", {
            installationId,
            iterations,
            correlationId,
          });
        }
      });
    }

    log.info("[backfill-orchestrator] complete", {
      installationId,
      provider,
      completed: succeeded.length,
      failed: failed.length,
      eventsProduced: completionResults.reduce(
        (sum, r) => sum + r.eventsProduced,
        0
      ),
      eventsDispatched: completionResults.reduce(
        (sum, r) => sum + r.eventsDispatched,
        0
      ),
      correlationId,
    });

    return {
      success: failed.length === 0,
      installationId,
      provider,
      workUnits: workUnits.length,
      skipped: workUnits.length - filteredWorkUnits.length,
      dispatched: filteredWorkUnits.length,
      completed: succeeded.length,
      failed: failed.length,
      eventsProduced: completionResults.reduce(
        (sum, r) => sum + r.eventsProduced,
        0
      ),
      eventsDispatched: completionResults.reduce(
        (sum, r) => sum + r.eventsDispatched,
        0
      ),
      results: completionResults,
    };
  }
);
