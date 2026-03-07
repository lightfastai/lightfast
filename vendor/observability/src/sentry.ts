/**
 * Thin re-exports of @sentry/core for Hono services.
 * Keeps app-layer code importing from @vendor/observability/sentry
 * instead of @sentry/core directly.
 */
export {
  addBreadcrumb,
  captureException,
  captureMessage,
  createStackParser,
  createTransport,
  initAndBind,
  nodeStackLineParser,
  ServerRuntimeClient,
  withScope,
} from "@sentry/core";

export type { Scope } from "@sentry/core";

import {
  createStackParser,
  createTransport,
  initAndBind,
  nodeStackLineParser,
  ServerRuntimeClient,
} from "@sentry/core";

interface SentryServiceInitOptions {
  dsn: string | undefined;
  environment: string | undefined;
  release: string | undefined;
  tracesSampleRate?: number;
}

/**
 * Shared Sentry init for Hono edge-runtime services.
 *
 * Uses @sentry/core (not @sentry/node) because these services run on
 * Vercel's edge runtime where Node.js-specific APIs aren't available.
 * Provides a proper stack parser and fetch-based transport.
 */
export function initSentryService(opts: SentryServiceInitOptions): void {
  initAndBind(ServerRuntimeClient, {
    dsn: opts.dsn,
    environment: opts.environment ?? "development",
    release: opts.release,
    sendDefaultPii: true,
    tracesSampleRate: opts.tracesSampleRate ?? 0.1,
    debug: false,
    integrations: [],
    stackParser: createStackParser(nodeStackLineParser()),
    transport: (transportOpts) =>
      createTransport(transportOpts, async (request) => {
        const response = await fetch(transportOpts.url, {
          method: "POST",
          body: request.body as string,
        });
        return { statusCode: response.status };
      }),
  });
}
