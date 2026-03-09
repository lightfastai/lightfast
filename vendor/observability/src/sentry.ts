/**
 * Thin re-exports of @sentry/core for Hono services.
 * Keeps app-layer code importing from @vendor/observability/sentry
 * instead of @sentry/core directly.
 */

export type { Scope } from "@sentry/core";
export {
  addBreadcrumb,
  captureException,
  captureMessage,
  createTransport,
  initAndBind,
  ServerRuntimeClient,
  withScope,
} from "@sentry/core";
