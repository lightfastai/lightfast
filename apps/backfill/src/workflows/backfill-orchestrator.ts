import { NonRetriableError } from "inngest";
import { createActor } from "xstate";
import { inngest } from "../inngest/client";
import { getConnector } from "@repo/console-backfill";
import type { BackfillConfig } from "@repo/console-backfill";
import { backfillMachine } from "../machine/backfill-machine";
import { transitionMachine, readContext } from "../machine/helpers";
import { env } from "../env";
import { gatewayUrl } from "../lib/related-projects";

export const backfillOrchestrator = inngest.createFunction(
  {
    id: "apps-backfill/run.orchestrator",
    name: "Backfill Orchestrator",
    retries: 3,
    concurrency: [
      { limit: 1, key: "event.data.installationId" }, // 1 backfill per connection
      { limit: 3 },                                     // 3 total concurrent backfills
    ],
    cancelOn: [
      {
        event: "apps-backfill/run.cancelled",
        match: "data.installationId",
      },
    ],
    timeouts: { start: "2m", finish: "60m" },
  },
  { event: "apps-backfill/run.requested" },
  async ({ event, step }) => {
    const { installationId, provider, orgId, depth, entityTypes } = event.data;

    // =========================================================================
    // Step 1: Initialize state machine
    // =========================================================================
    let machineSnapshot = await step.run("init-machine", () => {
      const actor = createActor(backfillMachine).start();
      actor.send({
        type: "START",
        installationId,
        provider,
        orgId,
        entityTypes: entityTypes ?? [],
      });
      const snapshot = actor.getPersistedSnapshot();
      actor.stop();
      return snapshot;
    });

    // =========================================================================
    // Step 2: Fetch connection details from Gateway
    // =========================================================================
    const connection = await step.run("get-connection", async () => {
      const response = await fetch(
        `${gatewayUrl}/connections/${installationId}`,
        { headers: { "X-API-Key": env.GATEWAY_API_KEY } },
      );
      if (!response.ok) {
        throw new Error(
          `Gateway getConnection failed: ${response.status} for ${installationId}`,
        );
      }
      const conn = await response.json() as {
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

    // =========================================================================
    // Step 3: Fetch access token from Gateway token vault
    // =========================================================================
    const { accessToken } = await step.run("get-token", async () => {
      const response = await fetch(
        `${gatewayUrl}/connections/${installationId}/token`,
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
    });

    // =========================================================================
    // Step 4: Get connector and validate scopes
    // =========================================================================
    const connector = getConnector(provider as Parameters<typeof getConnector>[0]);
    if (!connector) {
      throw new NonRetriableError(`No backfill connector for provider: ${provider}`);
    }

    const resolvedEntityTypes =
      entityTypes && entityTypes.length > 0
        ? entityTypes
        : connector.defaultEntityTypes;

    const since = new Date(
      Date.now() - depth * 24 * 60 * 60 * 1000,
    ).toISOString();

    const config: BackfillConfig = {
      installationId,
      provider: provider as BackfillConfig["provider"],
      depth,
      since,
      entityTypes: resolvedEntityTypes,
      accessToken,
      resources: connection.resources.map((r) => ({
        providerResourceId: r.providerResourceId,
        resourceName: r.resourceName,
      })),
    };

    await step.run("validate-scopes", async () => {
      await connector.validateScopes(config);
      return null;
    });

    // Transition machine to reflect validation done
    machineSnapshot = await step.run("validation-done", () => {
      return transitionMachine(machineSnapshot as Parameters<typeof transitionMachine>[0], {
        type: "VALIDATION_DONE",
      });
    });

    // =========================================================================
    // Step 5: Paginate through each entity type
    // =========================================================================
    for (const entityType of resolvedEntityTypes) {
      let cursor: unknown = null;
      let pageNum = 1;

      while (true) {
        // Fetch page of events from provider
        const fetchResult = await step.run(
          `fetch-${entityType}-p${pageNum}`,
          async () => {
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
          },
        );

        // Dispatch each event to Gateway service auth endpoint + update machine
        machineSnapshot = await step.run(
          `dispatch-${entityType}-p${pageNum}`,
          async () => {
            for (const webhookEvent of fetchResult.events) {
              const response = await fetch(
                `${gatewayUrl}/webhooks/${provider}`,
                {
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
                },
              );
              if (!response.ok) {
                const text = await response.text().catch(() => "unknown");
                throw new Error(
                  `Gateway ingestWebhook failed: ${response.status} — ${text}`,
                );
              }
            }

            // Transition machine within this step (no separate step = no extra step count)
            return transitionMachine(
              machineSnapshot as Parameters<typeof transitionMachine>[0],
              {
                type: "PAGE_FETCHED",
                rawCount: fetchResult.rawCount,
                rateLimit: fetchResult.rateLimit,
              },
            );
          },
        );

        machineSnapshot = transitionMachine(
          machineSnapshot as Parameters<typeof transitionMachine>[0],
          {
            type: "PAGE_DISPATCHED",
            count: fetchResult.events.length,
          },
        );

        // Rate limit sleep if near threshold
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
    }

    // =========================================================================
    // Step 6: Mark complete
    // =========================================================================
    machineSnapshot = transitionMachine(
      machineSnapshot as Parameters<typeof transitionMachine>[0],
      { type: "COMPLETE" },
    );

    const finalContext = readContext(
      machineSnapshot as Parameters<typeof readContext>[0],
    );

    return {
      success: true,
      installationId,
      provider,
      eventsProduced: finalContext.eventsProduced,
      eventsDispatched: finalContext.eventsDispatched,
    };
  },
);
