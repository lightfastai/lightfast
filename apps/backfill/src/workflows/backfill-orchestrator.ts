import { NonRetriableError } from "inngest";
import { inngest } from "../inngest/client";
import { getConnector } from "@repo/console-backfill";
import { env } from "../env";
import { connectionsUrl } from "../lib/related-projects";

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
    const { installationId, provider, orgId, depth, entityTypes } = event.data;

    // ── Step 1: Fetch connection details from Gateway ──
    const connection = await step.run("get-connection", async () => {
      const response = await fetch(
        `${connectionsUrl}/connections/${installationId}`,
        { headers: { "X-API-Key": env.GATEWAY_API_KEY } },
      );
      if (!response.ok) {
        throw new Error(
          `Gateway getConnection failed: ${response.status} for ${installationId}`,
        );
      }
      const conn = (await response.json()) as {
        id: string;
        provider: string;
        externalId: string;
        orgId: string;
        status: string;
        resources: {
          id: string;
          providerResourceId: string;
          resourceName: string | null;
        }[];
      };
      if (conn.status !== "active") {
        throw new NonRetriableError(
          `Connection is not active: ${installationId} (status: ${conn.status})`,
        );
      }
      return conn;
    });

    // ── Step 2: Resolve entity types and validate connector ──
    const connector = getConnector(
      provider as Parameters<typeof getConnector>[0],
    );
    if (!connector) {
      throw new NonRetriableError(
        `No backfill connector for provider: ${provider}`,
      );
    }

    const resolvedEntityTypes =
      entityTypes && entityTypes.length > 0
        ? entityTypes
        : connector.defaultEntityTypes;

    // Compute `since` once — all work units use the same time window
    const since = new Date(
      Date.now() - depth * 24 * 60 * 60 * 1000,
    ).toISOString();

    // ── Step 3: Enumerate work units (resource x entityType) ──
    const workUnits = connection.resources.flatMap((resource) =>
      resolvedEntityTypes.map((entityType) => ({
        entityType,
        resource: {
          providerResourceId: resource.providerResourceId,
          resourceName: resource.resourceName,
        },
        // Stable ID for step naming
        workUnitId: `${resource.providerResourceId}-${entityType}`,
      })),
    );

    if (workUnits.length === 0) {
      return {
        success: true,
        installationId,
        provider,
        workUnits: 0,
        eventsProduced: 0,
        eventsDispatched: 0,
      };
    }

    // ── Step 4: Fan-out — dispatch all work units ──
    await step.sendEvent(
      "fan-out-entity-workers",
      workUnits.map((wu) => ({
        name: "apps-backfill/entity.requested" as const,
        data: {
          installationId,
          provider,
          orgId,
          entityType: wu.entityType,
          resource: wu.resource,
          since,
          depth,
        },
      })),
    );

    // ── Step 5: Wait for all completion events ──
    // Each waitForEvent is dispatched in parallel via Promise.all
    // As each entity.completed event arrives, the matching wait resolves
    const completionResults = await Promise.all(
      workUnits.map(async (wu) => {
        const result = await step.waitForEvent(
          `wait-${wu.workUnitId}`,
          {
            event: "apps-backfill/entity.completed",
            if: `async.data.installationId == '${installationId}' && async.data.resourceId == '${wu.resource.providerResourceId}' && async.data.entityType == '${wu.entityType}'`,
            timeout: "4h",
          },
        );

        if (!result) {
          // waitForEvent returns null on timeout
          return {
            entityType: wu.entityType,
            resourceId: wu.resource.providerResourceId,
            success: false,
            eventsProduced: 0,
            eventsDispatched: 0,
            pagesProcessed: 0,
            error: "timeout — entity worker did not complete within 4 hours",
          };
        }

        return result.data;
      }),
    );

    // ── Step 6: Aggregate results ──
    const succeeded = completionResults.filter((r) => r.success);
    const failed = completionResults.filter((r) => !r.success);

    return {
      success: failed.length === 0,
      installationId,
      provider,
      workUnits: workUnits.length,
      completed: succeeded.length,
      failed: failed.length,
      eventsProduced: completionResults.reduce(
        (sum, r) => sum + r.eventsProduced,
        0,
      ),
      eventsDispatched: completionResults.reduce(
        (sum, r) => sum + r.eventsDispatched,
        0,
      ),
      results: completionResults,
    };
  },
);
