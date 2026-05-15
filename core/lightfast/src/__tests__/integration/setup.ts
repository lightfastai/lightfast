import { type ChildProcess, spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const POLL_INTERVAL_MS = 250;
const READY_TIMEOUT_MS = 60_000;

let serverProcess: ChildProcess | undefined;
let createdKeyId: string | undefined;

async function waitForReady(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return;
      }
    } catch {
      // not yet up
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Server not ready at ${url} within ${timeoutMs}ms`);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `[integration] missing required env var: ${name}. Set it in the test runner before invoking integration tests.`
    );
  }
  return v;
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

  const secretKey = requireEnv("CLERK_SECRET_KEY");
  const orgId = requireEnv("LIGHTFAST_TEST_CLERK_ORG_ID");
  const userId = requireEnv("LIGHTFAST_TEST_CLERK_USER_ID");

  const { createClerkClient } = await import("@vendor/clerk/backend");
  const clerk = createClerkClient({ secretKey });

  const key = await clerk.apiKeys.create({
    name: `integration-test-${Date.now()}`,
    subject: orgId,
    createdBy: userId,
  });

  if (!key.secret) {
    throw new Error(
      "[integration] Clerk apiKeys.create did not return a secret"
    );
  }

  createdKeyId = key.id;
  process.env.__INTEGRATION_API_KEY__ = key.secret;
  process.env.__INTEGRATION_BASE_URL__ = baseUrl;
}

export async function teardown() {
  if (process.env.LIGHTFAST_RUN_INTEGRATION !== "1") {
    return;
  }

  if (createdKeyId) {
    try {
      const { createClerkClient } = await import("@vendor/clerk/backend");
      const clerk = createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      await clerk.apiKeys.delete(createdKeyId);
    } catch (err) {
      console.warn("[integration] failed to delete Clerk API key", err);
    }
  }

  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }
}
