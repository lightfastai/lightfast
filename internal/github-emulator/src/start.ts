import { getGitHubEmulatorEnv } from "./fixtures";
import { startGitHubEmulator } from "./server";

const port = Number(process.env.PORT ?? 4567);
const appOrigin =
  process.env.LIGHTFAST_APP_ORIGIN ?? "https://app.lightfast.localhost";

const emulator = await startGitHubEmulator({ port });

console.log(`[github-emulator] listening on ${emulator.url}`);
for (const [key, value] of Object.entries(
  getGitHubEmulatorEnv(appOrigin, emulator.url)
)) {
  console.log(`${key}=${JSON.stringify(value)}`);
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
