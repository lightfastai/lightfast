import { sentryMiddleware } from "@inngest/middleware-sentry";
import { EventSchemas, Inngest, type InngestMiddleware } from "@vendor/inngest";
import { allEvents } from "./index.js";

export interface CreateInngestClientOptions {
  /** Service app name, e.g. "lightfast-console" or "lightfast-memory" */
  appName: string;
  eventKey?: string;
  /** Additional middleware beyond Sentry */
  middleware?: InngestMiddleware<any>[];
  /** Pass true to enable Sentry middleware (console service only) */
  withSentry?: boolean;
}

/**
 * Creates a fully-typed Inngest client with all platform, console, and memory
 * event schemas registered. Call once per service entry point.
 */
export function createInngestClient(options: CreateInngestClientOptions) {
  const { appName, eventKey, withSentry = false, middleware = [] } = options;

  const resolvedMiddleware = [
    ...(withSentry ? [sentryMiddleware()] : []),
    ...middleware,
  ];

  return new Inngest({
    id: appName,
    eventKey,
    schemas: new EventSchemas().fromSchema(allEvents),
    ...(resolvedMiddleware.length > 0
      ? {
          middleware: resolvedMiddleware as [
            InngestMiddleware<any>,
            ...InngestMiddleware<any>[],
          ],
        }
      : {}),
  });
}

/** Convenience type for consumers that need the full event map type */
export type { GetEvents } from "inngest";
