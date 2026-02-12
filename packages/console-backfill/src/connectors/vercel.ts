/**
 * Vercel Backfill Connector
 *
 * Fetches historical deployments from the Vercel API,
 * adapts them into webhook-compatible shapes, and transforms them
 * using the existing battle-tested transformer.
 */
import { transformVercelDeployment } from "@repo/console-webhooks/transformers";
import type { SourceEvent, TransformContext } from "@repo/console-types";
import type { BackfillConnector, BackfillConfig, BackfillPage } from "../types.js";
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
    const sourceConfig = config.sourceConfig;
    const projectId = sourceConfig.projectId as string;
    const teamId = sourceConfig.teamId as string | undefined;

    const url = new URL("https://api.vercel.com/v6/deployments");
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("limit", "1");
    if (teamId) url.searchParams.set("teamId", teamId);

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
    const sourceConfig = config.sourceConfig;
    const projectId = sourceConfig.projectId as string;
    const projectName = sourceConfig.projectName as string;
    const teamId = sourceConfig.teamId as string | undefined;

    // Build request URL
    const url = new URL("https://api.vercel.com/v6/deployments");
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("limit", "100");
    if (teamId) url.searchParams.set("teamId", teamId);
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

    // Filter deployments within the time window
    const filtered = data.deployments.filter((deployment) => {
      const created = deployment.created as number | undefined;
      return created ? new Date(created) >= sinceDate : false;
    });

    // Build transform context
    const page = cursor ?? 0;
    const context: TransformContext = {
      deliveryId: `backfill-${config.integrationId}-deployment-t${page}`,
      receivedAt: new Date(),
    };

    // Transform each deployment
    const events: SourceEvent[] = [];
    for (const deployment of filtered) {
      try {
        const { webhookPayload, eventType } =
          adaptVercelDeploymentForTransformer(deployment, projectName);
        const event = transformVercelDeployment(
          webhookPayload,
          eventType,
          context,
        );
        events.push(event);
      } catch (err) {
        console.error(
          `[VercelBackfill] Failed to transform deployment ${deployment.uid as string}:`,
          err,
        );
      }
    }

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
