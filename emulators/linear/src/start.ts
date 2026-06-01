import { createLinearEmulatorRuntimeEnv } from "./env";
import { getLinearEmulatorEnv } from "./fixtures";
import { startLinearEmulator } from "./server";

const env = createLinearEmulatorRuntimeEnv();

const sensitiveEnvKeyPattern = /(?:KEY|SECRET|TOKEN|PRIVATE)/i;

function redactEnvValueForLog(key: string, value: string): string {
  if (sensitiveEnvKeyPattern.test(key)) {
    return "<redacted>";
  }

  return value;
}

const emulator = await startLinearEmulator({
  appOrigin: env.appOrigin,
  host: env.host,
  port: env.port,
  publicOrigin: env.emulatorOrigin,
});

console.log(`[linear-emulator] listening on ${emulator.listenUrl}`);
console.log(`[linear-emulator] public origin ${emulator.publicOrigin}`);
for (const [key, value] of Object.entries(
  getLinearEmulatorEnv(env.appOrigin, emulator.publicOrigin)
)) {
  console.log(`${key}=${JSON.stringify(redactEnvValueForLog(key, value))}`);
}

async function close(signal: NodeJS.Signals) {
  console.log(`[linear-emulator] received ${signal}, shutting down`);
  await emulator.close();
  process.exit(0);
}

process.on("SIGINT", (signal) => {
  void close(signal);
});

process.on("SIGTERM", (signal) => {
  void close(signal);
});
