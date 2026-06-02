import { execFile, execFileSync, spawn } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  allowLocalhostTls,
  normalizeUrl,
  trimTrailingSlash,
} from "../helpers/env";

const execFileAsync = promisify(execFile);

const DEFAULT_SESSION_NAME = "lightfast-provider-routine-proxy-smoke";
const DEFAULT_EMAIL_DOMAIN = "lightfast.ai";
const LINEAR_EMULATOR_ACCESS_TOKEN = "linear_access_valid";
const LINEAR_EMULATOR_REFRESH_TOKEN = "linear_refresh_valid";
const LINEAR_EMULATOR_CLIENT_ID = "linear_lightfast_local";
const LINEAR_EMULATOR_CLIENT_SECRET = "linear-local-secret";
const LINEAR_EMULATOR_ACTOR_ID = "linear_actor_lightfast_local";
const LINEAR_EMULATOR_ACTOR_NAME = "Lightfast Local";
const LINEAR_EMULATOR_WORKSPACE_ID = "linear_workspace_lightfast_emulated";
const LINEAR_EMULATOR_WORKSPACE_NAME = "lightfast-emulated";
const CLI_LOGIN_TIMEOUT_MS = 120_000;

type Env = Record<string, string | undefined>;
type RestoreCallback = () => Promise<void>;

interface SmokeConfig {
  appOrigin: string;
  clerkSecretKey: string;
  cliConfigDir: string;
  emailAddress: string;
  linearMcpEndpoint: string;
  orgSlug: string;
  repoRoot: string;
  screenshotPath?: string;
  sessionName: string;
  username: string;
}

interface ClerkUser {
  id: string;
}

interface ClerkOrganization {
  id: string;
  slug: string;
}

interface BuildSmokeConfigInput {
  env?: Env;
  getPortlessUrl?: (name: string) => string;
  nowMs?: number;
}

function repoRootFromEntrypoint() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

function slugPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function createUniqueOrgSlug(input: { nowMs?: number; prefix?: string }) {
  const prefix = slugPart(input.prefix ?? "lf-proxy-e2e");
  return `${prefix || "lf-proxy-e2e"}-${input.nowMs ?? Date.now()}`;
}

function createUniqueUsername(input: { nowMs?: number; prefix?: string }) {
  const prefix = slugPart(input.prefix ?? "lf-proxy-user");
  return `${prefix || "lf-proxy-user"}-${input.nowMs ?? Date.now()}`;
}

async function buildSmokeConfig(
  input: BuildSmokeConfigInput = {}
): Promise<SmokeConfig> {
  const env = input.env ?? process.env;
  const clerkSecretKey = env.CLERK_SECRET_KEY?.trim();
  if (!clerkSecretKey) {
    throw new Error(
      "CLERK_SECRET_KEY is missing. Run this script through `pnpm with-env` from @lightfast/e2e."
    );
  }

  const getPortlessUrl = input.getPortlessUrl ?? readPortlessUrl;
  const nowMs = input.nowMs ?? Date.now();
  const orgSlug =
    env.LIGHTFAST_E2E_PROVIDER_PROXY_ORG_SLUG?.trim() ||
    createUniqueOrgSlug({
      nowMs,
      prefix: env.LIGHTFAST_E2E_PROVIDER_PROXY_ORG_SLUG_PREFIX,
    });
  const emailAddress =
    env.LIGHTFAST_E2E_PROVIDER_PROXY_EMAIL?.trim() ||
    `${slugPart(env.LIGHTFAST_E2E_PROVIDER_PROXY_EMAIL_PREFIX ?? "provider-proxy-smoke")}-${nowMs}@${DEFAULT_EMAIL_DOMAIN}`;

  return {
    appOrigin: normalizeUrl(
      env.LIGHTFAST_E2E_APP_URL?.trim() || getPortlessUrl("app.lightfast"),
      "LIGHTFAST_E2E_APP_URL"
    ),
    clerkSecretKey,
    cliConfigDir:
      env.LIGHTFAST_E2E_CLI_CONFIG_DIR?.trim() ||
      (await mkdtemp(path.join(tmpdir(), "lightfast-cli-smoke-"))),
    emailAddress,
    linearMcpEndpoint: normalizeUrl(
      env.LIGHTFAST_E2E_LINEAR_MCP_ENDPOINT?.trim() ||
        env.LINEAR_MCP_ENDPOINT?.trim() ||
        new URL("/mcp", getPortlessUrl("linear.lightfast")).toString(),
      "LIGHTFAST_E2E_LINEAR_MCP_ENDPOINT"
    ),
    orgSlug,
    repoRoot: repoRootFromEntrypoint(),
    screenshotPath:
      env.LIGHTFAST_E2E_PROVIDER_PROXY_SCREENSHOT?.trim() || undefined,
    sessionName:
      env.LIGHTFAST_E2E_AGENT_BROWSER_SESSION?.trim() ||
      `${DEFAULT_SESSION_NAME}-${nowMs}`,
    username:
      env.LIGHTFAST_E2E_PROVIDER_PROXY_USERNAME?.trim() ||
      createUniqueUsername({
        nowMs,
        prefix: env.LIGHTFAST_E2E_PROVIDER_PROXY_USERNAME_PREFIX,
      }),
  };
}

function boundPublicMetadata() {
  return {
    lf_binding_status: "bound",
    lightfast: {
      binding: {
        provider: "github",
        status: "bound",
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

async function fetchClerkJson<T>(
  config: SmokeConfig,
  clerkPath: `/${string}`,
  init: Omit<RequestInit, "body" | "headers"> & {
    body?: Record<string, unknown>;
  }
): Promise<T> {
  const res = await fetch(`https://api.clerk.com/v1${clerkPath}`, {
    ...init,
    body: init.body ? JSON.stringify(init.body) : undefined,
    headers: {
      authorization: `Bearer ${config.clerkSecretKey}`,
      "content-type": "application/json",
    },
  });
  const body = (await res.json().catch(() => null)) as
    | { errors?: Array<{ long_message?: string; message?: string }> }
    | T
    | null;

  if (!res.ok) {
    const errorBody =
      body && typeof body === "object" && "errors" in body
        ? (body as {
            errors?: Array<{ long_message?: string; message?: string }>;
          })
        : null;
    const message =
      errorBody?.errors?.[0]?.long_message ?? errorBody?.errors?.[0]?.message;
    throw new Error(
      `Clerk ${init.method ?? "GET"} ${clerkPath} failed: ${message ?? `HTTP ${res.status}`}`
    );
  }

  return body as T;
}

async function patchClerkJson(
  config: SmokeConfig,
  clerkPath: `/${string}`,
  body: object
): Promise<void> {
  const res = await fetch(`https://api.clerk.com/v1${clerkPath}`, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${config.clerkSecretKey}`,
      "content-type": "application/json",
    },
    method: "PATCH",
  });

  if (res.ok) {
    return;
  }

  const responseBody = (await res.json().catch(() => null)) as {
    errors?: Array<{ long_message?: string; message?: string }>;
  } | null;
  const message =
    responseBody?.errors?.[0]?.long_message ??
    responseBody?.errors?.[0]?.message ??
    `HTTP ${res.status}`;
  throw new Error(`Clerk PATCH ${clerkPath} failed: ${message}`);
}

async function createClerkUser(config: SmokeConfig) {
  return await fetchClerkJson<ClerkUser>(config, "/users", {
    body: {
      email_address: [config.emailAddress],
      first_name: "Provider Proxy",
      last_name: "Smoke",
      legal_accepted_at: new Date().toISOString(),
    },
    method: "POST",
  });
}

async function createClerkOrganization(config: SmokeConfig, userId: string) {
  return await fetchClerkJson<ClerkOrganization>(config, "/organizations", {
    body: {
      created_by: userId,
      name: config.orgSlug,
      public_metadata: boundPublicMetadata(),
      slug: config.orgSlug,
    },
    method: "POST",
  });
}

async function updateClerkUserLastActiveOrg(
  config: SmokeConfig,
  input: { orgId: string; userId: string }
) {
  await fetchClerkJson(config, `/users/${input.userId}/metadata`, {
    body: {
      public_metadata: {
        last_active_org: {
          id: input.orgId,
          slug: config.orgSlug,
        },
      },
    },
    method: "PATCH",
  });
}

async function createClerkSignInToken(config: SmokeConfig, userId: string) {
  const body = await fetchClerkJson<{ token: string }>(
    config,
    "/sign_in_tokens",
    {
      body: {
        expires_in_seconds: 600,
        user_id: userId,
      },
      method: "POST",
    }
  );
  if (!body.token) {
    throw new Error("Clerk sign-in token response did not include a token.");
  }
  return body.token;
}

async function createBoundSourceControlBinding(input: {
  orgId: string;
  orgSlug: string;
  userId: string;
}) {
  const [{ db }, { finalizeActiveOrgProviderBinding }] = await Promise.all([
    import("@db/app/client"),
    import("@db/app"),
  ]);
  const installationId = `install-${input.orgSlug}`;
  await finalizeActiveOrgProviderBinding(db, {
    clerkOrgId: input.orgId,
    connectedByUserId: input.userId,
    metadata: {
      lightfastRepository: {
        fullName: `${input.orgSlug}/.lightfast`,
        id: `repo-${input.orgSlug}`,
        installationId,
        name: ".lightfast",
        verifiedAt: new Date().toISOString(),
      },
    },
    provider: "github",
    providerAccountId: `acct-${input.orgSlug}`,
    providerAccountLogin: input.orgSlug,
    providerInstallationId: installationId,
  });
}

function configureLinearEnv(config: SmokeConfig) {
  const linearOrigin = new URL(config.linearMcpEndpoint).origin;
  process.env.NEXT_PUBLIC_APP_URL ||= config.appOrigin;
  process.env.LINEAR_API_ORIGIN ||= linearOrigin;
  process.env.LINEAR_CLIENT_ID ||= LINEAR_EMULATOR_CLIENT_ID;
  process.env.LINEAR_CLIENT_SECRET ||= LINEAR_EMULATOR_CLIENT_SECRET;
  process.env.LINEAR_MCP_ENDPOINT ||= config.linearMcpEndpoint;
  if (!process.env.NODE_ENV) {
    Object.assign(process.env, { NODE_ENV: "development" });
  }
}

function requireEncryptionKey() {
  const value = process.env.ENCRYPTION_KEY?.trim();
  if (!value) {
    throw new Error(
      "ENCRYPTION_KEY is missing. Run this script through `pnpm with-env` from @lightfast/e2e."
    );
  }
  return value;
}

async function createActiveLinearAgentConnection(input: {
  config: SmokeConfig;
  orgId: string;
  userId: string;
}) {
  configureLinearEnv(input.config);
  const [
    { db },
    {
      finalizeCurrentOrgConnectorConnection,
      setConnectorAgentEnabled,
      setConnectorAutomationEnabled,
    },
    { encrypt },
  ] = await Promise.all([
    import("@db/app/client"),
    import("@db/app"),
    import("@repo/app-encryption"),
  ]);
  const encryptionKey = requireEncryptionKey();

  const connection = await finalizeCurrentOrgConnectorConnection(db, {
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    clerkOrgId: input.orgId,
    connectedByUserId: input.userId,
    encryptedAccessToken: await encrypt(
      LINEAR_EMULATOR_ACCESS_TOKEN,
      encryptionKey
    ),
    encryptedRefreshToken: await encrypt(
      LINEAR_EMULATOR_REFRESH_TOKEN,
      encryptionKey
    ),
    mcpEndpoint: input.config.linearMcpEndpoint,
    metadata: {
      smoke: "provider-routine-proxy",
    },
    provider: "linear",
    providerActorId: LINEAR_EMULATOR_ACTOR_ID,
    providerActorName: LINEAR_EMULATOR_ACTOR_NAME,
    providerWorkspaceId: LINEAR_EMULATOR_WORKSPACE_ID,
    providerWorkspaceName: LINEAR_EMULATOR_WORKSPACE_NAME,
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    scopes: ["read", "write"],
    toolManifest: [
      {
        description: "Emulated Linear get_team",
        inputSchema: { additionalProperties: true, type: "object" },
        name: "get_team",
      },
    ],
  });

  await setConnectorAutomationEnabled(db, {
    clerkOrgId: input.orgId,
    enabled: true,
    provider: "linear",
  });
  await setConnectorAgentEnabled(db, {
    clerkOrgId: input.orgId,
    enabled: true,
    provider: "linear",
  });
  return connection;
}

async function agentBrowser(config: SmokeConfig, args: string[]) {
  return await runCommand("agent-browser", [
    "--session",
    config.sessionName,
    ...args,
  ]);
}

async function agentEval(config: SmokeConfig, js: string) {
  return await agentBrowser(config, ["eval", js]);
}

async function signInWithClerkTicket(
  config: SmokeConfig,
  input: { orgId: string; ticket: string }
) {
  await agentBrowser(config, ["open", `${config.appOrigin}/sign-in`]);
  await agentEval(
    config,
    `(async () => {
      const ticket = ${JSON.stringify(input.ticket)};
      const orgId = ${JSON.stringify(input.orgId)};
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (window.Clerk?.client?.signIn && window.Clerk?.setActive) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!window.Clerk?.client?.signIn || !window.Clerk?.setActive) {
        throw new Error("Clerk did not load");
      }
      const signIn = await window.Clerk.client.signIn.create({
        strategy: "ticket",
        ticket,
      });
      const sessionId = signIn.createdSessionId || signIn.created_session_id;
      if (!sessionId) {
        throw new Error("Clerk ticket sign-in did not create a session");
      }
      await window.Clerk.setActive({ organization: orgId, session: sessionId });
      return {
        orgId: window.Clerk.organization?.id ?? null,
        sessionId: window.Clerk.session?.id ?? null,
        status: signIn.status,
        userId: window.Clerk.user?.id ?? null,
      };
    })()`
  );
}

async function completeUsernameSetup(config: SmokeConfig) {
  const url = new URL("/account/tasks/username", config.appOrigin);
  url.searchParams.set("return_to", "/account/settings/general");

  await agentBrowser(config, ["open", url.toString()]);
  await agentBrowser(config, ["wait", "--text", "Choose your username"]);
  await agentBrowser(config, [
    "find",
    "label",
    "Username",
    "fill",
    config.username,
  ]);
  await agentBrowser(config, [
    "find",
    "role",
    "button",
    "click",
    "--name",
    "Continue",
  ]);
  await waitForUrl(
    config,
    (currentUrl) => currentUrl.pathname === "/account/settings/general",
    "username account setup completion"
  );
}

async function waitForUrl(
  config: SmokeConfig,
  predicate: (url: URL) => boolean,
  description: string,
  timeoutMs = 120_000
) {
  const deadline = Date.now() + timeoutMs;
  let lastUrl = "";
  while (Date.now() < deadline) {
    lastUrl = (await agentBrowser(config, ["get", "url"])).trim();
    try {
      const parsed = new URL(lastUrl);
      if (predicate(parsed)) {
        return parsed;
      }
    } catch {
      // Keep polling while the browser is between navigations.
    }
    await delay(1000);
  }

  const snapshot = await agentBrowser(config, ["snapshot", "-i", "-u"]).catch(
    (error) => String(error)
  );
  throw new Error(
    `Timed out waiting for ${description}. Last URL: ${lastUrl}\n${snapshot}`
  );
}

async function waitForAppHealth(config: SmokeConfig) {
  const healthUrl = new URL("/api/health", config.appOrigin).toString();
  const deadline = Date.now() + 120_000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        return;
      }
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(1000);
  }
  throw new Error(
    `Timed out waiting for app health at ${healthUrl}: ${lastError}`
  );
}

function cliEnv(
  config: SmokeConfig,
  extra: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...extra,
    LIGHTFAST_APP_URL: config.appOrigin,
    LIGHTFAST_CLI_CONFIG_DIR: config.cliConfigDir,
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
  } as NodeJS.ProcessEnv;
}

function shellSingleQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

async function createOpenShim(config: SmokeConfig) {
  const shimDir = await mkdtemp(path.join(tmpdir(), "lightfast-open-shim-"));
  const shimPath = path.join(shimDir, "open");
  await writeFile(
    shimPath,
    `#!/bin/sh\nexec agent-browser --session ${shellSingleQuote(config.sessionName)} open "$1"\n`
  );
  await chmod(shimPath, 0o755);
  return { shimDir, shimPath };
}

interface ClerkOAuthApplication {
  client_id?: string;
  consent_screen_enabled?: boolean;
  id: string;
  name: string;
  public?: boolean;
  redirect_uris?: string[];
  scopes?: string;
}

async function findCliClerkOAuthApplication(config: SmokeConfig) {
  const clientId = process.env.CLERK_CLI_OAUTH_CLIENT_ID?.trim();
  if (!clientId) {
    return null;
  }
  const response = await fetchClerkJson<{
    data?: ClerkOAuthApplication[];
  }>(config, "/oauth_applications?limit=100" as `/${string}`, {
    method: "GET",
  });
  return (
    response.data?.find((application) => application.client_id === clientId) ??
    null
  );
}

async function setClerkOAuthApplicationConsent(input: {
  application: ClerkOAuthApplication;
  config: SmokeConfig;
  enabled: boolean;
}) {
  await patchClerkJson(
    input.config,
    `/oauth_applications/${input.application.id}`,
    {
      consent_screen_enabled: input.enabled,
      name: input.application.name,
      public: input.application.public,
      redirect_uris: input.application.redirect_uris,
      scopes: input.application.scopes,
    }
  );
}

async function disableCliClerkOAuthConsentScreen(
  config: SmokeConfig
): Promise<RestoreCallback | null> {
  const application = await findCliClerkOAuthApplication(config);
  if (!application || application.consent_screen_enabled === false) {
    return null;
  }
  await setClerkOAuthApplicationConsent({
    application,
    config,
    enabled: false,
  });
  console.log("[smoke] Clerk CLI OAuth consent screen disabled for smoke");
  return async () => {
    await setClerkOAuthApplicationConsent({
      application,
      config,
      enabled: true,
    }).catch(() => undefined);
    console.log("[smoke] Clerk CLI OAuth consent screen restored");
  };
}

async function prepareClerkNativeAuthForSmoke(config: SmokeConfig) {
  const restoreCallbacks: RestoreCallback[] = [];
  const restoreConsentScreen = await disableCliClerkOAuthConsentScreen(config);
  if (restoreConsentScreen) {
    restoreCallbacks.push(restoreConsentScreen);
  }

  return async () => {
    for (const restore of restoreCallbacks.reverse()) {
      await restore().catch(() => undefined);
    }
  };
}

interface WatchedProcess {
  isRunning: () => boolean;
  kill: () => void;
  wait: (input: {
    command: string;
    killOnTimeout?: boolean;
    timeoutMs: number;
  }) => Promise<{ stderr: string; stdout: string }>;
}

function watchProcess(child: ReturnType<typeof spawn>): WatchedProcess {
  let stdout = "";
  let stderr = "";
  let closeCode: number | null | undefined;
  let closeError: Error | undefined;

  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const closePromise = new Promise<void>((resolve) => {
    child.on("error", (error) => {
      closeError = error;
      resolve();
    });
    child.on("close", (code) => {
      closeCode = code;
      resolve();
    });
  });

  async function wait(input: {
    command: string;
    killOnTimeout?: boolean;
    timeoutMs: number;
  }) {
    if (closeCode === undefined && !closeError) {
      const timeout = setTimeout(() => {
        if (input.killOnTimeout !== false) {
          child.kill("SIGTERM");
        }
      }, input.timeoutMs);

      const timedOut = await Promise.race([
        closePromise.then(() => false),
        delay(input.timeoutMs).then(() => true),
      ]);
      clearTimeout(timeout);
      if (timedOut) {
        throw new Error(
          `${input.command} timed out after ${input.timeoutMs}ms\n${stderr || stdout}`
        );
      }
    }

    if (closeError) {
      throw closeError;
    }
    if (closeCode === 0) {
      return { stderr, stdout };
    }
    throw new Error(
      `${input.command} exited with ${closeCode}\n${stderr || stdout}`
    );
  }

  return {
    isRunning: () => closeCode === undefined && !closeError,
    kill: () => {
      if (closeCode === undefined && !closeError) {
        child.kill("SIGTERM");
      }
    },
    wait,
  };
}

interface AgentBrowserNetworkLog {
  data?: {
    requests?: Array<{
      responseHeaders?: Record<string, string>;
      url?: string;
    }>;
  };
  success?: boolean;
}

function isLoopbackCallbackUrl(value: string | undefined) {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.pathname === "/callback" &&
      url.searchParams.has("state") &&
      (url.searchParams.has("code") || url.searchParams.has("error"))
    );
  } catch {
    return false;
  }
}

function findLoopbackCallbackUrl(rawNetworkLog: string) {
  const parsed = JSON.parse(rawNetworkLog) as AgentBrowserNetworkLog;
  const requests = parsed.data?.requests ?? [];
  for (const request of requests.slice().reverse()) {
    if (isLoopbackCallbackUrl(request.url)) {
      return request.url;
    }
    const location =
      request.responseHeaders?.Location ?? request.responseHeaders?.location;
    if (isLoopbackCallbackUrl(location)) {
      return location;
    }
  }
  return null;
}

async function replayLoopbackCallbackFromBrowserNetwork(input: {
  config: SmokeConfig;
  process: WatchedProcess;
  timeoutMs: number;
}) {
  const deadline = Date.now() + input.timeoutMs;
  let lastError = "";
  while (Date.now() < deadline && input.process.isRunning()) {
    try {
      const raw = await agentBrowser(input.config, [
        "network",
        "requests",
        "--json",
      ]);
      const callbackUrl = findLoopbackCallbackUrl(raw);
      if (callbackUrl) {
        const res = await fetch(callbackUrl);
        const body = await res.text();
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${body}`);
        }
        console.log("[smoke] replayed browser loopback callback");
        return;
      }
      lastError = "callback URL not found in browser network log";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }

  if (input.process.isRunning()) {
    console.log(`[smoke] loopback callback replay skipped: ${lastError}`);
  }
}

async function runCliLogin(config: SmokeConfig) {
  const { shimDir } = await createOpenShim(config);
  const restoreClerkNativeAuthConfig =
    await prepareClerkNativeAuthForSmoke(config);
  let loginProcess: WatchedProcess | undefined;
  let completed = false;
  try {
    await agentBrowser(config, ["network", "requests", "--clear"]).catch(
      () => undefined
    );
    const cliPath = path.join(config.repoRoot, "core/cli/dist/bin.mjs");
    const child = spawn(process.execPath, [cliPath, "login"], {
      cwd: config.repoRoot,
      env: cliEnv(config, {
        PATH: `${shimDir}:${process.env.PATH ?? ""}`,
      }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    loginProcess = watchProcess(child);

    await agentBrowser(config, [
      "wait",
      "--text",
      "Choose a Lightfast organization",
    ]);
    await agentBrowser(config, [
      "find",
      "role",
      "button",
      "click",
      "--name",
      `Continue with ${config.orgSlug}`,
    ]);

    await delay(3000);
    if (loginProcess.isRunning()) {
      await replayLoopbackCallbackFromBrowserNetwork({
        config,
        process: loginProcess,
        timeoutMs: 15_000,
      });
    }

    const result = await loginProcess.wait({
      command: "lightfast login",
      timeoutMs: CLI_LOGIN_TIMEOUT_MS,
    });
    completed = true;
    if (!result.stdout.includes("Logged in as")) {
      throw new Error(`CLI login output was unexpected:\n${result.stdout}`);
    }
    return result.stdout.trim();
  } finally {
    if (loginProcess && !completed && loginProcess.isRunning()) {
      loginProcess.kill();
    }
    await restoreClerkNativeAuthConfig();
    await rm(shimDir, { force: true, recursive: true }).catch(() => undefined);
  }
}

async function runCli(config: SmokeConfig, args: string[]) {
  return await runCommand(
    process.execPath,
    [path.join(config.repoRoot, "core/cli/dist/bin.mjs"), ...args],
    {
      cwd: config.repoRoot,
      env: cliEnv(config),
    }
  );
}

function parseCliJson<T>(output: string): T {
  try {
    return JSON.parse(output) as T;
  } catch (error) {
    throw new Error(
      `CLI did not return valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }\n${output}`
    );
  }
}

async function assertProviderRoutineLedger(input: {
  orgId: string;
  providerRoutineCallId: string;
}) {
  const [{ db }, { listProviderRoutineCalls }] = await Promise.all([
    import("@db/app/client"),
    import("@db/app"),
  ]);
  const calls = await listProviderRoutineCalls(db, {
    clerkOrgId: input.orgId,
    limit: 20,
  });
  const call = calls.find(
    (item) => item.publicId === input.providerRoutineCallId
  );
  if (!call) {
    throw new Error(
      `Provider routine call ${input.providerRoutineCallId} was not persisted.`
    );
  }
  if (call.status !== "succeeded") {
    throw new Error(
      `Expected provider routine call to succeed, got ${call.status}.`
    );
  }
  if (!call.providerAttempted) {
    throw new Error("Expected providerAttempted=true for live CLI call.");
  }
  if (call.sourceSurface !== "native_cli") {
    throw new Error(
      `Expected sourceSurface=native_cli, got ${call.sourceSurface}.`
    );
  }
  if (call.providerToolName !== "get_team") {
    throw new Error(
      `Expected providerToolName=get_team, got ${call.providerToolName}.`
    );
  }
}

async function assertDecisionsPageShowsCliCall(config: SmokeConfig) {
  await agentBrowser(config, [
    "open",
    `${config.appOrigin}/${config.orgSlug}/decisions`,
  ]);
  await waitForUrl(
    config,
    (url) => url.pathname === `/${config.orgSlug}/decisions`,
    "Decisions page"
  );
  await delay(1500);
  const rawText = await agentEval(config, "document.body.innerText");
  const text = JSON.parse(rawText) as string;
  const expected = ["Decisions", "get_team", "Succeeded", "User"];
  const missing = expected.filter((value) => !text.includes(value));
  if (missing.length > 0) {
    throw new Error(
      `Decisions page did not show CLI provider routine call: ${missing.join(", ")}\n${text}`
    );
  }
}

async function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {}
) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      encoding: "utf8",
      env: options.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.stdout.trim();
  } catch (error) {
    const failed = error as Error & { stderr?: string; stdout?: string };
    throw new Error(
      `${formatCommandForError(command, args)} failed:\n${
        failed.stderr || failed.stdout || failed.message
      }`
    );
  }
}

function formatCommandForError(command: string, args: string[]) {
  const evalIndex = command === "agent-browser" ? args.indexOf("eval") : -1;
  if (evalIndex >= 0) {
    return `${command} ${[...args.slice(0, evalIndex + 1), "<script>"].join(" ")}`;
  }
  return `${command} ${args.join(" ")}`;
}

function readPortlessUrl(name: string): string {
  return trimTrailingSlash(
    execFileSync("pnpm", ["--silent", "exec", "portless", "get", name], {
      cwd: repoRootFromEntrypoint(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
  );
}

export async function runRealProviderRoutineProxyCliSmoke(
  input: BuildSmokeConfigInput = {}
) {
  const config = await buildSmokeConfig(input);
  allowLocalhostTls(config.appOrigin);
  allowLocalhostTls(config.linearMcpEndpoint);

  console.log(`[smoke] app=${config.appOrigin}`);
  console.log(`[smoke] linear=${config.linearMcpEndpoint}`);
  console.log(`[smoke] org=${config.orgSlug}`);
  console.log(`[smoke] email=${config.emailAddress}`);
  console.log(`[smoke] username=${config.username}`);
  console.log(`[smoke] cliConfigDir=${config.cliConfigDir}`);

  try {
    await waitForAppHealth(config);
    const user = await createClerkUser(config);
    const org = await createClerkOrganization(config, user.id);
    await updateClerkUserLastActiveOrg(config, {
      orgId: org.id,
      userId: user.id,
    });
    await createBoundSourceControlBinding({
      orgId: org.id,
      orgSlug: config.orgSlug,
      userId: user.id,
    });
    const connection = await createActiveLinearAgentConnection({
      config,
      orgId: org.id,
      userId: user.id,
    });
    console.log(`[smoke] linearConnection=${connection.id}`);

    const ticket = await createClerkSignInToken(config, user.id);
    await signInWithClerkTicket(config, { orgId: org.id, ticket });
    await completeUsernameSetup(config);
    console.log("[smoke] username setup ok");

    const loginOutput = await runCliLogin(config);
    console.log(`[smoke] ${loginOutput}`);

    const whoami = await runCli(config, ["whoami"]);
    if (
      !(whoami.includes(config.emailAddress) && whoami.includes(config.orgSlug))
    ) {
      throw new Error(`Unexpected whoami output:\n${whoami}`);
    }
    console.log("[smoke] whoami ok");

    const findOutput = await runCli(config, [
      "proxy",
      "find",
      "team",
      "--provider",
      "linear",
      "--read-only",
      "--include-schema",
      "--limit",
      "5",
    ]);
    const findResult = parseCliJson<{
      routines: Array<{ routineId: string; providerToolName: string }>;
    }>(findOutput);
    if (
      !findResult.routines.some(
        (routine) =>
          routine.routineId === "linear__get_team" &&
          routine.providerToolName === "get_team"
      )
    ) {
      throw new Error(
        `proxy find did not return linear__get_team:\n${findOutput}`
      );
    }
    console.log("[smoke] proxy find ok");

    const callOutput = await runCli(config, [
      "proxy",
      "call",
      "linear__get_team",
      "--json",
      JSON.stringify({ id: "team-lightfast" }),
    ]);
    const callResult = parseCliJson<{
      providerRoutineCallId: string;
      result: unknown;
      routineId: string;
      status: string;
    }>(callOutput);
    const serializedCall = JSON.stringify(callResult);
    if (
      callResult.status !== "succeeded" ||
      callResult.routineId !== "linear__get_team" ||
      !serializedCall.includes("get_team") ||
      !serializedCall.includes("team-lightfast")
    ) {
      throw new Error(`Unexpected proxy call result:\n${callOutput}`);
    }
    console.log(`[smoke] proxy call ok id=${callResult.providerRoutineCallId}`);

    await assertProviderRoutineLedger({
      orgId: org.id,
      providerRoutineCallId: callResult.providerRoutineCallId,
    });
    console.log("[smoke] provider routine ledger ok");

    await assertDecisionsPageShowsCliCall(config);
    console.log("[smoke] decisions page ok");

    if (config.screenshotPath) {
      await agentBrowser(config, ["screenshot", config.screenshotPath]);
      console.log(`[smoke] screenshot=${config.screenshotPath}`);
    }

    console.log("[smoke] completed provider routine proxy CLI smoke");
  } finally {
    await agentBrowser(config, ["close"]).catch(() => undefined);
  }
}

function isMainModule() {
  const entrypoint = process.argv[1];
  return Boolean(
    entrypoint && path.resolve(entrypoint) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  runRealProviderRoutineProxyCliSmoke().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
