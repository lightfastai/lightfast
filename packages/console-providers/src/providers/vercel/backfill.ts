import type {
  BackfillContext,
  BackfillDef,
  BackfillWebhookEvent,
} from "../../define";
import { vercelDeploymentsResponseSchema } from "./api";
import type {
  PreTransformVercelWebhookPayload,
  VercelWebhookEventType,
} from "./schemas";

// ── Adapter Functions ─────────────────────────────────────────────────────────────

function mapReadyStateToEventType(readyState?: string): VercelWebhookEventType {
  switch (readyState) {
    case "READY":
      return "deployment.succeeded";
    case "ERROR":
      return "deployment.error";
    case "CANCELED":
      return "deployment.canceled";
    default:
      return "deployment.created";
  }
}

export function adaptVercelDeploymentForTransformer(
  deployment: Record<string, unknown>,
  projectName: string
): {
  webhookPayload: PreTransformVercelWebhookPayload;
  eventType: VercelWebhookEventType;
} {
  const eventType = mapReadyStateToEventType(
    deployment.readyState as string | undefined
  );
  const createdAt = (deployment.created as number | undefined) ?? Date.now();

  const webhookPayload: PreTransformVercelWebhookPayload = {
    id: `backfill-${deployment.uid as string}`,
    type: eventType,
    createdAt,
    payload: {
      deployment: {
        id: deployment.uid as string,
        name: deployment.name as string,
        url: deployment.url as string | undefined,
        readyState: deployment.readyState as
          | "READY"
          | "ERROR"
          | "BUILDING"
          | "QUEUED"
          | "CANCELED"
          | undefined,
        meta: deployment.meta as PreTransformVercelWebhookPayload["payload"]["deployment"] extends {
          meta?: infer M;
        }
          ? M
          : never,
      },
      project: {
        id: (deployment.projectId as string | undefined) ?? "",
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
  entityTypes: {
    deployment: {
      endpointId: "list-deployments",
      buildRequest(ctx: BackfillContext, cursor: unknown) {
        const queryParams: Record<string, string> = {
          projectId: ctx.resource.providerResourceId,
          limit: "100",
        };
        if (cursor !== null && cursor !== undefined) {
          queryParams.until = String(cursor);
        }
        return { queryParams };
      },
      processResponse(data: unknown, ctx: BackfillContext, _cursor: unknown) {
        const projectName =
          ctx.resource.resourceName ?? ctx.resource.providerResourceId;
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
            adaptVercelDeploymentForTransformer(
              deployment as unknown as Record<string, unknown>,
              projectName
            );
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
    },
  },
};
