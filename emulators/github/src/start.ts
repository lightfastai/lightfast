import { createGitHubEmulatorRuntimeEnv } from "./env";
import { getGitHubEmulatorEnv } from "./fixtures";
import { startGitHubEmulator } from "./server";

const env = createGitHubEmulatorRuntimeEnv();

const sensitiveEnvKeyPattern = /(?:KEY|SECRET|TOKEN|PRIVATE)/i;

function redactEnvValueForLog(key: string, value: string): string {
  if (sensitiveEnvKeyPattern.test(key)) {
    return "<redacted>";
  }

  return value;
}

const emulator = await startGitHubEmulator({
  appOrigin: env.appOrigin,
  host: env.host,
  port: env.port,
  publicOrigin: env.emulatorOrigin,
});

console.log(`[github-emulator] listening on ${emulator.listenUrl}`);
console.log(`[github-emulator] public origin ${emulator.publicOrigin}`);
for (const [key, value] of Object.entries(
  getGitHubEmulatorEnv(env.appOrigin, emulator.publicOrigin)
)) {
  console.log(`${key}=${JSON.stringify(redactEnvValueForLog(key, value))}`);
}

async function close(signal: NodeJS.Signals) {
  console.log(`[github-emulator] received ${signal}, shutting down`);
  await emulator.close();
  process.exit(0);
}

process.on("SIGINT", (signal) => {
  void close(signal);
});

process.on("SIGTERM", (signal) => {
  void close(signal);
});
