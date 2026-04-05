import { z } from "zod";

export type { BackfillDepth } from "../client/options";
export { BACKFILL_DEPTH_OPTIONS, backfillDepthSchema } from "../client/options";

export const backfillWebhookEventSchema = z.object({
  /** Unique per event: "backfill-{installationId}-{entityType}-{itemId}" */
  deliveryId: z.string(),
  /** Provider-specific event type, e.g. "pull_request", "issues", "deployment.succeeded" */
  eventType: z.string(),
  /** Webhook-shaped payload from adapter — matches PreTransform* schemas */
  payload: z.unknown(),
});

export type BackfillWebhookEvent = z.infer<typeof backfillWebhookEventSchema>;

export const backfillContextSchema = z.object({
  /** Gateway installation ID */
  installationId: z.string(),
  /** Single resource for this work unit */
  resource: z.object({
    providerResourceId: z.string(),
    resourceName: z.string(),
  }),
  /** ISO timestamp = now - depth days */
  since: z.string(),
});

export type BackfillContext = z.infer<typeof backfillContextSchema>;

// ── Backfill interfaces (contain functions — cannot be Zod) ─────────────────────

/** How to backfill a single entity type using a provider API endpoint */
export interface BackfillEntityHandler {
  /** Build the request parameters for the gateway proxy.
   *  Called once per page. `cursor` is null for the first page. */
  buildRequest(
    ctx: BackfillContext,
    cursor: unknown
  ): {
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  };
  /** Which API endpoint to use from the provider's api.endpoints catalog */
  readonly endpointId: string;
  /** Process the raw API response into webhook events + next cursor.
   *  `responseHeaders` is provided for providers that need
   *  header-based pagination (e.g., Sentry's Link header cursors). */
  processResponse(
    data: unknown,
    ctx: BackfillContext,
    cursor: unknown,
    responseHeaders?: Record<string, string>
  ): {
    events: BackfillWebhookEvent[];
    nextCursor: unknown | null;
    rawCount: number;
  };
}

/** Type-safe factory that narrows cursor type within a handler implementation,
 *  then erases to BackfillEntityHandler for the heterogeneous entityTypes record.
 *
 *  Usage:
 *    issue: typedEntityHandler<string>({ endpointId: "...", buildRequest(ctx, cursor) { ... }, processResponse(data, ctx, cursor) { ... } })
 *    pull_request: typedEntityHandler<{ page: number }>({ ... })
 */
export function typedEntityHandler<TCursor>(handler: {
  endpointId: string;
  buildRequest(
    ctx: BackfillContext,
    cursor: TCursor | null
  ): {
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  };
  processResponse(
    data: unknown,
    ctx: BackfillContext,
    cursor: TCursor | null,
    responseHeaders?: Record<string, string>
  ): {
    events: BackfillWebhookEvent[];
    nextCursor: TCursor | null;
    rawCount: number;
  };
}): BackfillEntityHandler {
  return handler as BackfillEntityHandler;
}

/** Backfill definition — required on every ProviderDefinition */
export interface BackfillDef {
  readonly defaultEntityTypes: readonly string[];
  readonly entityTypes: Record<string, BackfillEntityHandler>;
  /** Resolve resource metadata (e.g., owner/repo) live from provider API.
   *  Replaces stale DB-stored resourceName with current values.
   *  Called once per resource at the start of backfill orchestration. */
  readonly resolveResourceMeta: (params: {
    providerResourceId: string;
    token: string;
  }) => Promise<string>;
  readonly supportedEntityTypes: readonly string[];
}
