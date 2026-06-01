import { createXEmulatorRuntimeEnv } from "./env";
import { getXEmulatorEnv } from "./fixtures";
import { startXEmulator } from "./server";

const env = createXEmulatorRuntimeEnv();

const sensitiveEnvKeyPattern = /(?:KEY|SECRET|TOKEN|PRIVATE)/i;

function redactEnvValueForLog(key: string, value: string): string {
  if (sensitiveEnvKeyPattern.test(key)) {
    return "<redacted>";
  }

  return value;
}

const emulator = await startXEmulator({
  appOrigin: env.appOrigin,
  host: env.host,
  port: env.port,
  publicOrigin: env.emulatorOrigin,
});

console.log(`[x-emulator] listening on ${emulator.listenUrl}`);
console.log(`[x-emulator] public origin ${emulator.publicOrigin}`);
for (const [key, value] of Object.entries(
  getXEmulatorEnv(env.appOrigin, emulator.publicOrigin)
)) {
  console.log(`${key}=${JSON.stringify(redactEnvValueForLog(key, value))}`);
}

async function close(signal: NodeJS.Signals) {
  console.log(`[x-emulator] received ${signal}, shutting down`);
  await emulator.close();
  process.exit(0);
}

process.on("SIGINT", (signal) => {
  void close(signal);
});

process.on("SIGTERM", (signal) => {
  void close(signal);
});
