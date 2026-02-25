/**
 * @repo/console-webhooks
 *
 * Webhook event transformers, validation, and storage utilities for Console integrations.
 *
 * Signature verification is handled by the Gateway service (apps/gateway/).
 * This package provides:
 * - Event transformers (GitHub, Vercel, Linear, Sentry) that produce SourceEvent shapes
 * - Payload validation against Zod schemas
 * - Sanitization utilities for webhook content
 * - Storage helpers for ingestion payloads
 * - Type re-exports for Linear and Sentry webhook shapes
 */

// Type re-exports for Linear and Sentry webhook shapes
export * from "./linear.js";
export * from "./sentry.js";

// Validation utilities
export * from "./validation.js";

// Sanitization utilities
export * from "./sanitize.js";

// Storage utilities
export { storeIngestionPayload, extractWebhookHeaders } from "./storage.js";
export type { StoreIngestionPayloadParams, StoreWebhookPayloadParams } from "./storage.js";

// Transformers
export * from "./transformers/index.js";
