import type { SourceType } from "@repo/console-validation";

/**
 * Standardized event format from any source.
 * This is what webhook handlers produce and the pipeline consumes.
 */
export interface SourceEvent {
  // Actor (source-specific, resolved later)
  actor?: SourceActor;
  body: string; // Full content for detailed embedding

  // Source-specific metadata (passed through to observation)
  metadata: Record<string, unknown>;

  // Temporal
  occurredAt: string; // ISO timestamp when event happened

  // Relationships
  references: SourceReference[];
  // Source identification
  source: SourceType;
  sourceId: string; // Unique ID: "pr:lightfastai/lightfast#123"
  /**
   * Internal event type format.
   * Uses <event-name>.<action> convention with hyphens (kebab-case).
   * Examples: "pull-request.opened", "deployment.succeeded", "push"
   *
   * Note: Typed as string for backward compatibility with existing data.
   * New events should use InternalEventType values from @repo/console-types.
   * @see {@link ../integrations/event-types.ts#InternalEventType}
   */
  sourceType: string; // Internal format: "pull-request.merged", "deployment.succeeded"

  // Content
  title: string; // <=120 chars, embeddable headline
}

/**
 * Actor who performed the action in the source system
 */
export interface SourceActor {
  avatarUrl?: string;
  email?: string; // For cross-source identity resolution
  id: string; // Source-specific ID (e.g., GitHub user ID)
  name: string; // Display name
}

/**
 * Relationship reference extracted from source event.
 */
export interface SourceReference {
  id: string;
  label?: string; // Relationship qualifier: "fixes", "closes", "blocks"
  type:
    | "commit"
    | "branch"
    | "pr"
    | "issue"
    | "deployment"
    | "project"
    | "cycle"
    | "assignee"
    | "reviewer"
    | "team"
    | "label";
  url?: string;
}

/**
 * Context for transformation
 */
export interface TransformContext {
  deliveryId: string; // Webhook delivery ID for idempotency
  receivedAt: Date; // When webhook was received
}
