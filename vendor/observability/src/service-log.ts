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

  return {
    debug: (msg, ctx) => { void logtail.debug(msg, ctx); },
    info: (msg, ctx) => { void logtail.info(msg, ctx); },
    warn: (msg, ctx) => { void logtail.warn(msg, ctx); },
    error: (msg, ctx) => { void logtail.error(msg, ctx); },
    flush: () => logtail.flush(),
  };
}
