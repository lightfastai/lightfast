import type { SourceType } from "@repo/console-validation";

/** A single webhook-shaped event ready for Relay ingestion */
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
  rateLimit?: {
    remaining: number;
    resetAt: Date;
    limit: number;
  };
  rawCount: number;
}

export interface BackfillConfig {
  /**
   * Decrypted access token from Connections token vault.
   * @internal SENSITIVE — never log or serialize BackfillConfig objects directly.
   * Use only for Authorization headers within connectors.
   */
  accessToken: string;
  /** Installation ID (gw_installations.id) */
  installationId: string;
  /** Provider name */
  provider: SourceType;
  /** Single resource for this work unit */
  resource: {
    providerResourceId: string;
    resourceName: string | null;
  };
  /** ISO timestamp = now - depth days */
  since: string;
}

export interface BackfillConnector<TCursor = unknown> {
  readonly defaultEntityTypes: string[];
  estimateTotal?(
    config: BackfillConfig,
    entityType: string
  ): Promise<number | null>;
  fetchPage(
    config: BackfillConfig,
    entityType: string,
    cursor: TCursor | null
  ): Promise<BackfillPage<TCursor>>;
  readonly provider: SourceType;
  readonly supportedEntityTypes: string[];
  validateScopes(config: BackfillConfig): Promise<void>;
}
