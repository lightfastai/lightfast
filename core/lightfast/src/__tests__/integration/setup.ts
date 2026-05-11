import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const POLL_INTERVAL_MS = 250;
const READY_TIMEOUT_MS = 60_000;

let serverProcess: ChildProcess | undefined;

async function waitForReady(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not yet up
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Server not ready at ${url} within ${timeoutMs}ms`);
}

export async function setup() {
  if (process.env.LIGHTFAST_RUN_INTEGRATION !== "1") {
    return;
  }

  // Portless serves the local aggregate via self-signed HTTPS; the test
  // process needs to accept it. Scoped to integration mode only.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const baseUrl =
    process.env.LIGHTFAST_INTEGRATION_BASE_URL ??
    "https://app.lightfast.localhost";
  const healthUrl = `${baseUrl}/api/health`;

  const skipBoot = process.env.LIGHTFAST_INTEGRATION_SKIP_BOOT === "1";

  if (!skipBoot) {
    serverProcess = spawn("pnpm", ["dev:app"], {
      cwd: new URL("../../../../..", import.meta.url).pathname,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });
    serverProcess.stdout?.on("data", (chunk: Buffer) => {
      process.stdout.write(`[dev:app] ${chunk.toString()}`);
    });
    serverProcess.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(`[dev:app] ${chunk.toString()}`);
    });
  }

  await waitForReady(healthUrl, READY_TIMEOUT_MS);

  const { db } = await import("@db/app/client");
  const { orgApiKeys } = await import("@db/app/schema");
  const { generateOrgApiKey, hashApiKey } = await import("@repo/app-api-key");

  const { key } = generateOrgApiKey();
  await db.insert(orgApiKeys).values({
    publicId: "akey_test_integration_health",
    name: "integration-test-system-health",
    keyHash: hashApiKey(key),
    keyPrefix: key.slice(0, 6),
    keySuffix: key.slice(-4),
    clerkOrgId: "org_test_integration_health",
    createdByUserId: "user_test_integration_health",
    isActive: true,
  });

  process.env.__INTEGRATION_API_KEY__ = key;
  process.env.__INTEGRATION_BASE_URL__ = baseUrl;
}

export async function teardown() {
  if (process.env.LIGHTFAST_RUN_INTEGRATION !== "1") {
    return;
  }

  const { db } = await import("@db/app/client");
  const { orgApiKeys } = await import("@db/app/schema");
  const { eq } = await import("drizzle-orm");
  await db
    .delete(orgApiKeys)
    .where(eq(orgApiKeys.publicId, "akey_test_integration_health"));

  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }
}
