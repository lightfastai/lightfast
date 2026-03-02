import { createClient } from "@vercel/flags-core";
import type { ProviderName } from "@repo/gateway-types";

type FlagsClient = ReturnType<typeof createClient>;

let client: FlagsClient | null = null;
let initPromise: Promise<void> | null = null;

function getClient(): FlagsClient | null {
  if (client) return client;
  const sdkKey = process.env.FLAGS;
  if (!sdkKey) return null;
  client = createClient(sdkKey, {
    stream: { initTimeoutMs: 2000 },
    polling: { intervalMs: 30_000, initTimeoutMs: 5000 },
  });
  return client;
}

async function ensureInitialized(): Promise<FlagsClient | null> {
  const c = getClient();
  if (!c) return null;
  if (!initPromise) {
    const result = c.initialize();
    initPromise = result instanceof Promise ? result : Promise.resolve();
  }
  await initPromise;
  return c;
}

/**
 * Whether webhooks should be fanned out to Console.
 * Default: true (enabled) — preserves existing behavior when flags aren't configured.
 * Set to false in Vercel Dashboard to disable console delivery.
 * Supports per-provider targeting rules when provider context is provided.
 */
export async function isConsoleFanOutEnabled(
  provider?: ProviderName,
): Promise<boolean> {
  const c = await ensureInitialized();
  if (!c) return true;
  const context = provider ? { provider } : undefined;
  const result = await c.evaluate<boolean>("console-fan-out", true, context);
  return result.value ?? true;
}
