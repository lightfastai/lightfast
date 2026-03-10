import { getProvider } from "@repo/console-providers";
import {
  createGatewayClient,
  createRelayClient,
} from "@repo/gateway-service-clients";
import { NonRetriableError } from "@vendor/inngest";

import { env } from "../env.js";
import { inngest } from "../inngest/client.js";
import { backfillEntityWorker } from "./entity-worker.js";

export const backfillOrchestrator = inngest.createFunction(
  {
    id: "apps-backfill/run.orchestrator",
    name: "Backfill Orchestrator",
    retries: 3,
    concurrency: [
      // 1 backfill per connection — prevents duplicate backfills
      { limit: 1, key: "event.data.installationId" },
      // 10 total concurrent orchestrators (each lightweight — just fan-out + wait)
      { limit: 10 },
    ],
    cancelOn: [
      {
        event: "apps-backfill/run.cancelled",
        match: "data.installationId",
      },
    ],
    // Orchestrator waits for all entity workers — must accommodate the longest
    // Worst case: 15 work units (5 repos x 3 entities), 5 concurrent, each 2hr
    // = 15/5 * 2hr = 6hr total. Set to 8hr for safety.
    timeouts: { start: "2m", finish: "8h" },
  },
  { event: "apps-backfill/run.requested" },
  async ({ event, step }) => {
    const {
      installationId,
      provider,
      orgId,
      depth,
      entityTypes,
      holdForReplay,
      correlationId: rawCorrelationId,
    } = event.data;
    const correlationId = rawCorrelationId as string | undefined;

    if (depth <= 0) {
      throw new NonRetriableError(
        `Invalid depth: ${depth} — must be a positive number of days`
      );
    }

    const gw = createGatewayClient({
      apiKey: env.GATEWAY_API_KEY,
      correlationId,
      requestSource: "backfill",
    });

    // ── Step 1: Fetch connection details from Gateway service ──
    const connection = await step.run("get-connection", async () => {
      const conn = await gw.getConnection(installationId);
      if (conn.status !== "active") {
        throw new NonRetriableError(
          `Connection is not active: ${installationId} (status: ${conn.status})`
        );
      }
      return conn;
    });

    // ── Step 1b: Fetch backfill history from Gateway ──
    const backfillHistory = await step.run("get-backfill-history", () =>
      gw.getBackfillRuns(installationId, "completed")
    );

    // ── Step 2: Resolve entity types and validate provider ──
    const providerDef = getProvider(provider);
    if (!providerDef) {
      throw new NonRetriableError(
        `No backfill provider for provider: ${provider}`
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
    const workUnits = connection.resources.flatMap((resource) =>
      resolvedEntityTypes.map((entityType: string) => ({
        entityType,
        resource: {
          providerResourceId: resource.providerResourceId,
          resourceName: resource.resourceName,
        },
        // Stable ID for step naming
        workUnitId: `${resource.providerResourceId}-${entityType}`,
      }))
    );

    // ── Gap-aware filtering: skip entity types fully covered by prior runs ──
    // A prior run "covers" an entity type if its `since` is earlier-or-equal
    // to the requested `since` — meaning it already fetched a wider or equal range.
    // deliveryId dedup at the relay handles any overlap on boundaries.
    const filteredWorkUnits = workUnits.filter((wu) => {
      const priorRun = backfillHistory.find(
        (h) => h.entityType === wu.entityType
      );
      if (!priorRun) {
        return true; // No prior run — must fetch
      }
      // Prior run's since ≤ requested since → already covered
      return new Date(priorRun.since) > new Date(since);
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

    // ── Step 4: Invoke entity workers directly ──
    const completionResults = await Promise.all(
      filteredWorkUnits.map(async (wu) => {
        try {
          const result = await step.invoke(`invoke-${wu.workUnitId}`, {
            function: backfillEntityWorker,
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

    // ── Step 6b: Persist consolidated run records ──
    // One record per entityType, with stats summed across all resources.
    // Only writes "completed" when ALL resources for that entityType succeeded.
    if (completionResults.length > 0) {
      await step.run("persist-run-records", async () => {
        const byEntityType = new Map<string, typeof completionResults>();
        for (const r of completionResults) {
          const existing = byEntityType.get(r.entityType) ?? [];
          existing.push(r);
          byEntityType.set(r.entityType, existing);
        }

        for (const [entityType, results] of byEntityType) {
          const allSucceeded = results.every((r) => r.success);
          await gw.upsertBackfillRun(installationId, {
            entityType,
            since,
            depth,
            status: allSucceeded ? "completed" : "failed",
            pagesProcessed: results.reduce((s, r) => s + r.pagesProcessed, 0),
            eventsProduced: results.reduce((s, r) => s + r.eventsProduced, 0),
            eventsDispatched: results.reduce(
              (s, r) => s + r.eventsDispatched,
              0
            ),
            error: allSucceeded
              ? undefined
              : results.find((r) => !r.success)?.error,
          });
        }
      });
    }

    // ── Step 7: Replay held webhooks (atomic delivery) ──
    // When holdForReplay is set, entity workers persist webhooks without delivery.
    // After all workers complete, drain them through the admin catchup endpoint
    // so Console receives historical events in chronological order as a single batch.
    if (holdForReplay && succeeded.length > 0) {
      const relay = createRelayClient({
        apiKey: env.GATEWAY_API_KEY,
        correlationId,
        requestSource: "backfill",
      });
      await step.run("replay-held-webhooks", async () => {
        const BATCH_SIZE = 200;
        const MAX_ITERATIONS = 500; // Safety cap: 500 * 200 = 100k webhooks max
        let remaining = 1;
        let iterations = 0;

        while (remaining > 0 && iterations < MAX_ITERATIONS) {
          iterations++;
          try {
            const result = await relay.replayCatchup(
              installationId,
              BATCH_SIZE
            );
            remaining = result.remaining;
          } catch {
            break;
          }
        }

        if (iterations >= MAX_ITERATIONS && remaining > 0) {
          console.error("[backfill] replay-held-webhooks hit iteration cap", {
            installationId,
            iterations,
            remaining,
          });
        }
      });
    }

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
