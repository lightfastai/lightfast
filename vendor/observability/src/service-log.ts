import { Logtail } from "@logtail/edge";
import type { Logger } from "./types.js";

export interface ServiceLogger extends Logger {
  /** Flush pending logs. MUST be called before serverless function completes. */
  flush(): Promise<unknown>;
}

export interface ServiceLoggerConfig {
  /** BetterStack source token. If undefined, falls back to console. */
  token: string | undefined;
  /** Service name injected into every log entry. */
  service: string;
  /** Vercel environment. Logs ship to BetterStack only in "production" | "preview". */
  environment: string | undefined;
}

/**
 * Create a structured logger for Hono services.
 *
 * - production/preview with token → BetterStack (Logtail)
 * - development or missing token → console
 */
export function createServiceLogger(config: ServiceLoggerConfig): ServiceLogger {
  const shouldShip =
    config.token &&
    (config.environment === "production" || config.environment === "preview");

  if (!shouldShip) {
    return {
      debug: (msg, ctx) => console.debug(msg, ctx),
      info: (msg, ctx) => console.info(msg, ctx),
      warn: (msg, ctx) => console.warn(msg, ctx),
      error: (msg, ctx) => console.error(msg, ctx),
      flush: () => Promise.resolve(),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const logtail = new Logtail(config.token!);

  // Enrich every log with service name and environment
  logtail.use((log) => Promise.resolve({
    ...log,
    service: config.service,
    environment: config.environment,
  }));

  const handleError = (err: unknown) => {
    console.error("[service-log] failed to ship log to BetterStack", err);
  };

  return {
    debug: (msg, ctx) => { logtail.debug(msg, ctx).catch(handleError); },
    info: (msg, ctx) => { logtail.info(msg, ctx).catch(handleError); },
    warn: (msg, ctx) => { logtail.warn(msg, ctx).catch(handleError); },
    error: (msg, ctx) => { logtail.error(msg, ctx).catch(handleError); },
    flush: () => logtail.flush(),
  };
}
