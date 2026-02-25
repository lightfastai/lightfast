/**
 * Vercel Backfill Connector
 *
 * Fetches historical deployments from the Vercel API, adapts them into
 * webhook-compatible shapes for direct ingestion through Gateway's service
 * auth endpoint. Produces raw webhook payloads (adapter output), not SourceEvents.
 */
import type { BackfillConnector, BackfillConfig, BackfillPage, BackfillWebhookEvent } from "../types.js";
import {
  adaptVercelDeploymentForTransformer,
  parseVercelRateLimit,
} from "../adapters/vercel.js";

/** Cursor is the `until` timestamp (ms) for Vercel's pagination */
type VercelCursor = number;

interface VercelDeploymentsResponse {
  deployments: Array<Record<string, unknown>>;
  pagination: {
    count: number;
    next: number | null;
    prev: number | null;
  };
}

class VercelBackfillConnector implements BackfillConnector<VercelCursor> {
  readonly provider = "vercel" as const;
  readonly supportedEntityTypes = ["deployment"];
  readonly defaultEntityTypes = ["deployment"];

  async validateScopes(config: BackfillConfig): Promise<void> {
    const projectId = config.resource.providerResourceId;
    const url = new URL("https://api.vercel.com/v6/deployments");
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("limit", "1");

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(
        `Vercel API returned ${response.status}: unable to access deployments for project ${projectId}`,
      );
    }
  }

  async fetchPage(
    config: BackfillConfig,
    entityType: string,
    cursor: VercelCursor | null,
  ): Promise<BackfillPage<VercelCursor>> {
    if (entityType !== "deployment") {
      throw new Error(`Unsupported entity type: ${entityType}`);
    }

    return this.fetchDeployments(config, cursor);
  }

  private async fetchDeployments(
    config: BackfillConfig,
    cursor: VercelCursor | null,
  ): Promise<BackfillPage<VercelCursor>> {
    // providerResourceId is the Vercel project ID
    const projectId = config.resource.providerResourceId;
    // resourceName is the project name
    const projectName = config.resource.resourceName ?? projectId;

    // Build request URL
    const url = new URL("https://api.vercel.com/v6/deployments");
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("until", cursor.toString());

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(
        `Vercel API returned ${response.status} when fetching deployments`,
      );
    }

    const data = (await response.json()) as VercelDeploymentsResponse;
    const sinceDate = new Date(config.since);

    // Filter deployments within the time window and with a valid uid
    const filtered = data.deployments.filter((deployment) => {
      const created = deployment.created as number | undefined;
      return created ? new Date(created) >= sinceDate : false;
    }).filter((deployment): deployment is Record<string, unknown> & { uid: string } =>
      typeof deployment.uid === "string",
    );

    const events: BackfillWebhookEvent[] = filtered.map((deployment) => {
      const { webhookPayload, eventType } = adaptVercelDeploymentForTransformer(
        deployment,
        projectName,
      );
      return {
        deliveryId: `backfill-${config.installationId}-${config.resource.providerResourceId}-deploy-${deployment.uid}`,
        eventType,
        payload: webhookPayload,
      };
    });

    const rateLimit = parseVercelRateLimit(response.headers);

    // Continue if there's a next page AND all items were within the time window
    const hasMore =
      data.pagination.next !== null &&
      filtered.length === data.deployments.length;

    return {
      events,
      nextCursor: hasMore ? data.pagination.next : null,
      rawCount: data.deployments.length,
      rateLimit,
    };
  }
}

export const vercelBackfillConnector = new VercelBackfillConnector();
