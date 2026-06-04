import { flagsEnv } from "@vendor/vercel-flags/env";
import { createClient } from "@vercel/flags-core";

interface BooleanFlagDefinition {
  defaultValue: boolean;
  key: string;
}

export const featureFlags = {
  developerConnections: {
    defaultValue: false,
    key: "developer-connections",
  },
} as const satisfies Record<string, BooleanFlagDefinition>;

export const DEVELOPER_CONNECTIONS_FLAG_KEY =
  featureFlags.developerConnections.key;

type FlagsClient = ReturnType<typeof createClient>;

const clientOptions = {
  stream: { initTimeoutMs: 2000 },
  polling: { intervalMs: 30_000, initTimeoutMs: 5000 },
};

let client: FlagsClient | null = null;
let initPromise: Promise<void> | null = null;

function getFlagsClient(): FlagsClient | null {
  if (client) {
    return client;
  }
  const sdkKey = flagsEnv.FLAGS;
  if (!sdkKey) {
    return null;
  }
  client = createClient(sdkKey, clientOptions);
  return client;
}

async function ensureInitialized() {
  const flagsClient = getFlagsClient();
  if (!flagsClient) {
    return null;
  }
  if (!initPromise) {
    const result = flagsClient.initialize();
    initPromise = result instanceof Promise ? result : Promise.resolve();
  }
  try {
    await initPromise;
  } catch {
    initPromise = null;
    return null;
  }
  return flagsClient;
}

async function evaluateBooleanFlag(definition: BooleanFlagDefinition) {
  const flagsClient = await ensureInitialized();
  if (!flagsClient) {
    return definition.defaultValue;
  }
  const result = await flagsClient.evaluate<boolean>(
    definition.key,
    definition.defaultValue
  );
  return result.value ?? definition.defaultValue;
}

export function isDeveloperConnectionsEnabled() {
  return evaluateBooleanFlag(featureFlags.developerConnections);
}
