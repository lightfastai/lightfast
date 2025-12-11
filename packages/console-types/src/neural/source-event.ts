/**
 * Standardized event format from any source.
 * This is what webhook handlers produce and the pipeline consumes.
 */
export interface SourceEvent {
  // Source identification
  source: "github" | "vercel" | "linear" | "sentry";
  sourceType: string; // e.g., "pull_request_merged", "deployment.succeeded"
  sourceId: string; // Unique ID: "pr:lightfastai/lightfast#123"

  // Content
  title: string; // <=120 chars, embeddable headline
  body: string; // Full content for detailed embedding

  // Actor (source-specific, resolved later)
  actor?: SourceActor;

  // Temporal
  occurredAt: string; // ISO timestamp when event happened

  // Relationships
  references: SourceReference[];

  // Source-specific metadata (passed through to observation)
  metadata: Record<string, unknown>;
}

/**
 * Actor who performed the action in the source system
 */
export interface SourceActor {
  id: string; // Source-specific ID (e.g., GitHub user ID)
  name: string; // Display name
  email?: string; // For cross-source identity resolution
  avatarUrl?: string;
}

/**
 * Relationship reference extracted from source event.
 */
export interface SourceReference {
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
  id: string;
  url?: string;
  label?: string; // Relationship qualifier: "fixes", "closes", "blocks"
}

/**
 * Context for transformation
 */
export interface TransformContext {
  deliveryId: string; // Webhook delivery ID for idempotency
  receivedAt: Date; // When webhook was received
}
