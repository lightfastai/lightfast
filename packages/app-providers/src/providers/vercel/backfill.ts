import type { z } from "zod";
import type {
  BackfillContext,
  BackfillDef,
  BackfillWebhookEvent,
} from "../../provider/backfill";
import { typedEntityHandler } from "../../provider/backfill";
import {
  type vercelDeploymentSchema,
  vercelDeploymentsResponseSchema,
} from "./api";
import type {
  PreTransformVercelWebhookPayload,
  VercelWebhookEventType,
} from "./schemas";

// ── Type Aliases ──────────────────────────────────────────────────────────────────

type VercelDeployment = z.infer<typeof vercelDeploymentSchema>;

// ── Adapter Functions ─────────────────────────────────────────────────────────────

function mapReadyStateToEventType(readyState?: string): VercelWebhookEventType {
  switch (readyState) {
    case "READY":
      return "deployment.succeeded";
    default:
      return "deployment.created";
  }
}

export function adaptVercelDeploymentForTransformer(
  deployment: VercelDeployment & { uid: string },
  projectName: string
): {
  webhookPayload: PreTransformVercelWebhookPayload;
  eventType: VercelWebhookEventType;
} {
  const eventType = mapReadyStateToEventType(deployment.readyState);
  const createdAt = deployment.created ?? Date.now();

  const webhookPayload: PreTransformVercelWebhookPayload = {
    id: `backfill-${deployment.uid}`,
    type: eventType,
    createdAt,
    payload: {
      deployment: {
        id: deployment.uid,
        name: deployment.name,
        url: deployment.url,
        readyState: deployment.readyState,
        meta: deployment.meta,
      },
      project: {
        id: deployment.projectId ?? "",
        name: projectName,
      },
    },
  };

  return { webhookPayload, eventType };
}

// ── Backfill Definition ───────────────────────────────────────────────────────────

export const vercelBackfill: BackfillDef = {
  supportedEntityTypes: ["deployment"],
  defaultEntityTypes: ["deployment"],
  resolveResourceMeta: async ({ providerResourceId, token }) => {
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${providerResourceId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) {
      return providerResourceId;
    }
    const project = (await res.json()) as { name?: string };
    return project.name ?? providerResourceId;
  },
  entityTypes: {
    deployment: typedEntityHandler<number>({
      endpointId: "list-deployments",
      buildRequest(ctx: BackfillContext, cursor: number | null) {
        const queryParams: Record<string, string> = {
          projectId: ctx.resource.providerResourceId,
          limit: "100",
        };
        if (cursor !== null) {
          queryParams.until = String(cursor);
        }
        return { queryParams };
      },
      processResponse(
        data: unknown,
        ctx: BackfillContext,
        _cursor: number | null
      ) {
        const projectName =
          ctx.resource.resourceName || ctx.resource.providerResourceId;
        const parsed = vercelDeploymentsResponseSchema.parse(data);
        const { deployments, pagination } = parsed;
        const sinceTimestamp = new Date(ctx.since).getTime();

        const filtered = deployments.filter(
          (deployment): deployment is typeof deployment & { uid: string } =>
            typeof deployment.uid === "string" &&
            typeof deployment.created === "number" &&
            deployment.created >= sinceTimestamp
        );

        const events: BackfillWebhookEvent[] = filtered.map((deployment) => {
          const { webhookPayload, eventType } =
            adaptVercelDeploymentForTransformer(deployment, projectName);
          return {
            deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-deploy-${deployment.uid}`,
            eventType,
            payload: webhookPayload,
          };
        });

        const hasMore =
          pagination.next !== null && filtered.length === deployments.length;

        return {
          events,
          nextCursor: hasMore ? pagination.next : null,
          rawCount: deployments.length,
        };
      },
    }),
  },
};
