import { createEmulatorEnv } from "./env";
import { formatEnvString } from "./format";
import type { EmulatorManifest } from "./manifest";

const SENSITIVE_ENV_KEY_PATTERN = /(?:KEY|SECRET|TOKEN|PRIVATE)/i;

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function redactEnvValueForLog(key: string, value: string): string {
  return SENSITIVE_ENV_KEY_PATTERN.test(key) ? "<redacted>" : value;
}

export function runEnvSh(manifest: EmulatorManifest): void {
  const callbackUrl = readOption("--callback-url");
  const publicOrigin = readOption("--public-origin");

  const env = createEmulatorEnv(manifest, {
    ...process.env,
    ...(callbackUrl ? { CALLBACK_URL: callbackUrl } : {}),
    ...(publicOrigin ? { PUBLIC_ORIGIN: publicOrigin } : {}),
  });

  const origin = env.publicOrigin ?? `http://127.0.0.1:${env.port}`;
  console.log(
    formatEnvString(
      manifest.env({ callbackUrl: env.callbackUrl, publicOrigin: origin })
    )
  );
}

export async function runStart(manifest: EmulatorManifest): Promise<void> {
  const env = createEmulatorEnv(manifest);
  const emulator = await manifest.start({
    callbackUrl: env.callbackUrl,
    host: env.host,
    port: env.port,
    publicOrigin: env.publicOrigin,
  });

  const label = `[${manifest.name}-emulator]`;
  console.log(`${label} listening on ${emulator.listenUrl}`);
  console.log(`${label} public origin ${emulator.publicOrigin}`);
  for (const [key, value] of Object.entries(
    manifest.env({
      callbackUrl: env.callbackUrl,
      publicOrigin: emulator.publicOrigin,
    })
  )) {
    console.log(`${key}=${JSON.stringify(redactEnvValueForLog(key, value))}`);
  }

  const close = async (signal: NodeJS.Signals) => {
    console.log(`${label} received ${signal}, shutting down`);
    await emulator.close();
    process.exit(0);
  };

  process.on("SIGINT", (signal) => {
    void close(signal);
  });
  process.on("SIGTERM", (signal) => {
    void close(signal);
  });
}
