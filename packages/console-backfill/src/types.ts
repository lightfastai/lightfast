import type { SourceType } from "@repo/console-validation";

/** A single webhook-shaped event ready for Gateway ingestion */
export interface BackfillWebhookEvent {
  /** Unique per event: "backfill-{installationId}-{entityType}-{itemId}" */
  deliveryId: string;
  /** Provider-specific event type, e.g. "pull_request", "issues", "release", "deployment.succeeded" */
  eventType: string;
  /** Webhook-shaped payload from adapter (PullRequestEvent, IssuesEvent, ReleaseEvent, VercelWebhookPayload, etc.) */
  payload: unknown;
}

export interface BackfillPage<TCursor = unknown> {
  events: BackfillWebhookEvent[];
  nextCursor: TCursor | null;
  rawCount: number;
  rateLimit?: {
    remaining: number;
    resetAt: Date;
    limit: number;
  };
}

export interface BackfillConfig {
  /** Gateway installation ID (gw_installations.id) */
  installationId: string;
  /** Provider name */
  provider: SourceType;
  /** Number of days to backfill */
  depth: 7 | 30 | 90;
  /** ISO timestamp = now - depth days */
  since: string;
  /** Entity types to fetch */
  entityTypes: string[];
  /** Decrypted access token from Gateway token vault */
  accessToken: string;
  /** Active resources from GET /connections/:id */
  resources: Array<{
    providerResourceId: string;
    resourceName: string | null;
  }>;
}

export interface BackfillCheckpoint<TCursor = unknown> {
  currentEntityType: string;
  cursor: TCursor | null;
  eventsProduced: number;
  eventsDispatched: number;
  errors: Array<{ entityType: string; message: string; timestamp: string }>;
  updatedAt: string;
}

export interface BackfillConnector<TCursor = unknown> {
  readonly provider: SourceType;
  readonly supportedEntityTypes: string[];
  readonly defaultEntityTypes: string[];
  validateScopes(config: BackfillConfig): Promise<void>;
  fetchPage(
    config: BackfillConfig,
    entityType: string,
    cursor: TCursor | null,
  ): Promise<BackfillPage<TCursor>>;
  estimateTotal?(
    config: BackfillConfig,
    entityType: string,
  ): Promise<number | null>;
}
