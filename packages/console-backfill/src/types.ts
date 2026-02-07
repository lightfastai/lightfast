import type { SourceEvent } from "@repo/console-types";
import type { SourceType } from "@repo/console-validation";

export interface BackfillConfig {
  integrationId: string;
  workspaceId: string;
  clerkOrgId: string;
  depth: 7 | 30 | 90;
  /** ISO timestamp = now - depth days */
  since: string;
  entityTypes: string[];
  sourceConfig: Record<string, unknown>;
  /** Populated inside workflow only, never serialized in event data */
  accessToken: string;
}

export interface BackfillPage<TCursor = unknown> {
  events: SourceEvent[];
  nextCursor: TCursor | null;
  rawCount: number;
  rateLimit?: {
    remaining: number;
    resetAt: Date;
    limit: number;
  };
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
