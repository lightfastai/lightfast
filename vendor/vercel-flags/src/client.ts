import { createClient } from "@vercel/flags-core";
import { flagsEnv } from "~/env";

type FlagsClient = ReturnType<typeof createClient>;

export interface FlagsClientOptions {
  /** SSE stream config */
  stream?: { initTimeoutMs: number };
  /** Polling fallback config */
  polling?: { intervalMs: number; initTimeoutMs: number };
}

const DEFAULT_OPTIONS: FlagsClientOptions = {
  stream: { initTimeoutMs: 2000 },
  polling: { intervalMs: 30_000, initTimeoutMs: 5000 },
};

let client: FlagsClient | null = null;
let initPromise: Promise<void> | null = null;

function getClient(options?: FlagsClientOptions): FlagsClient | null {
  if (client) return client;
  const sdkKey = flagsEnv.FLAGS;
  if (!sdkKey) return null;
  const opts = options ?? DEFAULT_OPTIONS;
  client = createClient(sdkKey, opts);
  return client;
}

async function ensureInitialized(
  options?: FlagsClientOptions,
): Promise<FlagsClient | null> {
  const c = getClient(options);
  if (!c) return null;
  if (!initPromise) {
    const result = c.initialize();
    initPromise = result instanceof Promise ? result : Promise.resolve();
  }
  await initPromise;
  return c;
}

/**
 * Evaluate a boolean feature flag.
 *
 * Returns `defaultValue` when the FLAGS SDK key is not configured,
 * or when the flag cannot be resolved.
 */
export async function evaluateFlag(
  key: string,
  defaultValue: boolean,
  context?: Record<string, unknown>,
  options?: FlagsClientOptions,
): Promise<boolean> {
  const c = await ensureInitialized(options);
  if (!c) return defaultValue;
  const result = await c.evaluate<boolean>(key, defaultValue, context);
  return result.value ?? defaultValue;
}
