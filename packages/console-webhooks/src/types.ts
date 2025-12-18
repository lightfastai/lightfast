/**
 * Type definitions for webhook verification
 */

/**
 * Base webhook verification result
 */
export interface WebhookVerificationResult<T = unknown> {
  /**
   * Whether the webhook signature was successfully verified
   */
  verified: boolean;

  /**
   * The parsed webhook event data (only present if verified)
   */
  event?: T;

  /**
   * Error message if verification failed
   */
  error?: string;
}

/**
 * GitHub webhook event types (subset - extend as needed)
 */
export interface GitHubWebhookEvent {
  action?: string;
  repository?: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  installation?: {
    id: number;
  };
  sender?: {
    login: string;
    id: number;
  };
  [key: string]: unknown;
}

/**
 * GitHub webhook verification result
 */
export type GitHubWebhookVerificationResult =
  WebhookVerificationResult<GitHubWebhookEvent>;

/**
 * Webhook signature verification error types
 */
export enum WebhookError {
  MISSING_SIGNATURE = "MISSING_SIGNATURE",
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  MISSING_PAYLOAD = "MISSING_PAYLOAD",
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  TIMESTAMP_TOO_OLD = "TIMESTAMP_TOO_OLD",
  TIMESTAMP_INVALID = "TIMESTAMP_INVALID",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Error messages for webhook verification failures
 */
export const WebhookErrorMessages: Record<WebhookError, string> = {
  [WebhookError.MISSING_SIGNATURE]: "Webhook signature header is missing",
  [WebhookError.INVALID_SIGNATURE]: "Webhook signature verification failed",
  [WebhookError.MISSING_PAYLOAD]: "Webhook payload is missing or empty",
  [WebhookError.INVALID_PAYLOAD]: "Webhook payload is not valid JSON",
  [WebhookError.TIMESTAMP_TOO_OLD]:
    "Webhook timestamp is too old (possible replay attack)",
  [WebhookError.TIMESTAMP_INVALID]: "Webhook timestamp is invalid",
  [WebhookError.INTERNAL_ERROR]: "Internal error during webhook verification",
};
