import { execFile, execFileSync } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  providerRoutineCallSuccessSchema,
  providerRoutineId,
} from "@repo/api-contract";
import { signServiceJWT } from "@repo/service-jwt";

import {
  allowLocalhostTls,
  normalizeUrl,
  trimTrailingSlash,
} from "../helpers/env";

const execFileAsync = promisify(execFile);

const DEFAULT_SESSION_NAME = "lightfast-decisions-smoke";
const DEFAULT_EMAIL_DOMAIN = "lightfast.ai";
const LINEAR_EMULATOR_ACCESS_TOKEN = "linear_access_valid";
const LINEAR_EMULATOR_REFRESH_TOKEN = "linear_refresh_valid";
const LINEAR_EMULATOR_CLIENT_ID = "linear_lightfast_local";
const LINEAR_EMULATOR_CLIENT_SECRET = "linear-local-secret";
const LINEAR_EMULATOR_ACTOR_ID = "linear_actor_lightfast_local";
const LINEAR_EMULATOR_ACTOR_NAME = "Lightfast Local";
const LINEAR_EMULATOR_WORKSPACE_ID = "linear_workspace_lightfast_emulated";
const LINEAR_EMULATOR_WORKSPACE_NAME = "lightfast-emulated";
const RUNTIME_DECISION_TOOL_NAME = "get_team";
const RUNTIME_DECISION_PROXY_TIMEOUT_MS = 30_000;
const SERVICE_JWT_SECRET_MIN_LENGTH = 32;

type Env = Record<string, string | undefined>;

export interface DecisionsSmokeConfig {
  appOrigin: string;
  clerkSecretKey: string;
  emailAddress: string;
  linearMcpEndpoint: string;
  orgSlug: string;
  runtimeDecisionEnabled: boolean;
  screenshotPath?: string;
  serviceJwtSecret?: string;
  sessionName: string;
}

export interface BuildDecisionsSmokeConfigInput {
  env?: Env;
  getPortlessUrl?: (name: string) => string;
  nowMs?: number;
}

interface ClerkUser {
  id: string;
}

interface ClerkOrganization {
  id: string;
  slug: string;
}

export function createUniqueDecisionsOrgSlug(input: {
  nowMs?: number;
  prefix?: string;
}) {
  const prefix = slugPart(input.prefix ?? "lf-decisions-e2e");
  const timestampMs = input.nowMs ?? Date.now();
  return `${prefix || "lf-decisions-e2e"}-${timestampMs}`;
}

export function buildDecisionsSmokeConfig(
  input: BuildDecisionsSmokeConfigInput = {}
): DecisionsSmokeConfig {
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
    env.LIGHTFAST_E2E_DECISIONS_ORG_SLUG?.trim() ||
    createUniqueDecisionsOrgSlug({
      nowMs,
      prefix: env.LIGHTFAST_E2E_DECISIONS_ORG_SLUG_PREFIX,
    });
  const emailAddress =
    env.LIGHTFAST_E2E_DECISIONS_EMAIL?.trim() ||
    `${slugPart(env.LIGHTFAST_E2E_DECISIONS_EMAIL_PREFIX ?? "decisions-smoke")}-${nowMs}@${DEFAULT_EMAIL_DOMAIN}`;
  const runtimeDecisionEnabled =
    env.LIGHTFAST_E2E_DECISIONS_RUNTIME_CALL !== "0";
  const serviceJwtSecret = env.SERVICE_JWT_SECRET?.trim() || undefined;
  if (runtimeDecisionEnabled) {
    requireRuntimeServiceJwtSecret(serviceJwtSecret);
  }

  return {
    appOrigin: normalizeUrl(
      env.LIGHTFAST_E2E_APP_URL?.trim() || getPortlessUrl("app.lightfast"),
      "LIGHTFAST_E2E_APP_URL"
    ),
    clerkSecretKey,
    emailAddress,
    linearMcpEndpoint: normalizeUrl(
      env.LIGHTFAST_E2E_LINEAR_MCP_ENDPOINT?.trim() ||
        env.LINEAR_MCP_ENDPOINT?.trim() ||
        new URL("/mcp", getPortlessUrl("linear.lightfast")).toString(),
      "LIGHTFAST_E2E_LINEAR_MCP_ENDPOINT"
    ),
    orgSlug,
    runtimeDecisionEnabled,
    screenshotPath: env.LIGHTFAST_E2E_DECISIONS_SCREENSHOT?.trim() || undefined,
    serviceJwtSecret,
    sessionName:
      env.LIGHTFAST_E2E_AGENT_BROWSER_SESSION?.trim() ||
      `${DEFAULT_SESSION_NAME}-${nowMs}`,
  };
}

function requireRuntimeServiceJwtSecret(secret: string | undefined): string {
  if (!secret || secret.length < SERVICE_JWT_SECRET_MIN_LENGTH) {
    throw new Error(
      `SERVICE_JWT_SECRET must be at least ${SERVICE_JWT_SECRET_MIN_LENGTH} characters when runtime Decision proof is enabled. Set LIGHTFAST_E2E_DECISIONS_RUNTIME_CALL=0 to skip that proof.`
    );
  }
  return secret;
}

function slugPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
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
  config: DecisionsSmokeConfig,
  path: `/${string}`,
  init: Omit<RequestInit, "body" | "headers"> & {
    body?: Record<string, unknown>;
  }
): Promise<T> {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${config.clerkSecretKey}`,
      "content-type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const body = (await res.json().catch(() => null)) as
    | {
        errors?: Array<{ long_message?: string; message?: string }>;
      }
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
      `Clerk ${init.method ?? "GET"} ${path} failed: ${message ?? `HTTP ${res.status}`}`
    );
  }
  return body as T;
}

async function createClerkUser(config: DecisionsSmokeConfig) {
  return await fetchClerkJson<ClerkUser>(config, "/users", {
    body: {
      email_address: [config.emailAddress],
      first_name: "Decisions",
      last_name: "Smoke",
      legal_accepted_at: new Date().toISOString(),
    },
    method: "POST",
  });
}

async function createClerkOrganization(
  config: DecisionsSmokeConfig,
  userId: string
) {
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
  config: DecisionsSmokeConfig,
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

async function createClerkSignInToken(
  config: DecisionsSmokeConfig,
  userId: string
) {
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

async function seedDecisionRows(input: {
  providerConnectionId: number;
  orgId: string;
  userId: string;
  nowMs?: number;
}) {
  const [
    { db },
    {
      createProviderRoutineCall,
      markProviderRoutineCallFailed,
      markProviderRoutineCallSucceeded,
    },
  ] = await Promise.all([import("@db/app/client"), import("@db/app")]);
  const now = input.nowMs ?? Date.now();

  const success = await createProviderRoutineCall(db, {
    calledById: "automation_run_daily-triage",
    calledByKind: "automation",
    clerkOrgId: input.orgId,
    inputRedacted: { present: true },
    provider: "linear",
    providerActorId: "linear-user-agent",
    providerConnectionId: input.providerConnectionId,
    providerToolName: "create_issue",
    providerWorkspaceId: "linear-workspace-lightfast",
    routineId: "linear__create_issue",
    sourceSurface: "automation",
    sourceRef: "run_decisions_seed_success",
    startedAt: new Date(now - 12 * 60 * 1000),
  });
  await markProviderRoutineCallSucceeded(db, {
    clerkOrgId: input.orgId,
    finishedAt: new Date(now - 12 * 60 * 1000 + 1840),
    outputRedacted: { present: true },
    publicId: success.publicId,
  });

  const failed = await createProviderRoutineCall(db, {
    calledById: "chat_message_decision-1",
    calledByKind: "user",
    calledByUserId: input.userId,
    clerkOrgId: input.orgId,
    inputRedacted: { present: true },
    provider: "linear",
    providerActorId: "linear-user-agent",
    providerConnectionId: input.providerConnectionId,
    providerToolName: "list_issues",
    providerWorkspaceId: "linear-workspace-lightfast",
    routineId: "linear__list_issues",
    sourceSurface: "hosted_mcp",
    sourceRef: "mcp_decisions_seed_failed",
    sourceClientId: "mcp_decisions_seed_client",
    startedAt: new Date(now - 7 * 60 * 1000),
  });
  await markProviderRoutineCallFailed(db, {
    clerkOrgId: input.orgId,
    errorCode: "LINEAR_MCP_TIMEOUT",
    errorMessage: "Linear MCP tool call timed out.",
    finishedAt: new Date(now - 7 * 60 * 1000 + 9500),
    publicId: failed.publicId,
  });

  await createProviderRoutineCall(db, {
    calledById: "system-sync-linear-webhook",
    calledByKind: "system",
    clerkOrgId: input.orgId,
    inputRedacted: { present: true },
    provider: "linear",
    providerActorId: "linear-app-lightfast",
    providerConnectionId: input.providerConnectionId,
    providerToolName: "sync_webhook_event",
    providerWorkspaceId: "linear-workspace-lightfast",
    routineId: "linear__sync_webhook_event",
    sourceSurface: "system",
    sourceRef: "system_decisions_seed_running",
    startedAt: new Date(now - 90 * 1000),
  });
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

function configureLinearRuntimeEnv(config: DecisionsSmokeConfig) {
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

async function createActiveLinearRuntimeConnection(input: {
  config: DecisionsSmokeConfig;
  orgId: string;
  userId: string;
}): Promise<number> {
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
      smoke: "decisions-runtime",
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
        name: RUNTIME_DECISION_TOOL_NAME,
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
  return connection.id;
}

async function recordRuntimeDecision(input: {
  config: DecisionsSmokeConfig;
  orgId: string;
  userId: string;
}) {
  configureLinearRuntimeEnv(input.config);
  allowLocalhostTls(input.config.linearMcpEndpoint);

  await callRuntimeDecisionThroughAppProxy({
    appOrigin: input.config.appOrigin,
    orgId: input.orgId,
    serviceJwtSecret: requireRuntimeServiceJwtSecret(
      input.config.serviceJwtSecret
    ),
    userId: input.userId,
  });
}

export async function callRuntimeDecisionThroughAppProxy(input: {
  appOrigin: string;
  fetchFn?: typeof fetch;
  orgId: string;
  serviceJwtSecret: string;
  timeoutMs?: number;
  userId: string;
}) {
  const token = await signServiceJWT({
    audience: "lightfast-app",
    caller: "mcp",
    jwtSecret: input.serviceJwtSecret,
  });
  const timeoutMs = input.timeoutMs ?? RUNTIME_DECISION_PROXY_TIMEOUT_MS;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const fetchFn = input.fetchFn ?? fetch;

  let response: Response;
  try {
    response = await fetchFn(
      new URL("/api/internal/mcp/proxy/call", input.appOrigin),
      {
        body: JSON.stringify({
          actor: {
            clientId: "decisions-runtime-smoke",
            grantId: `decisions-runtime-smoke:${input.orgId}`,
            kind: "mcp",
            orgId: input.orgId,
            userId: input.userId,
          },
          input: {
            input: { id: "team-lightfast" },
            routineId: providerRoutineId("linear", RUNTIME_DECISION_TOOL_NAME),
          },
          scopes: {
            providerRoutineRead: true,
            providerRoutineWrite: true,
          },
        }),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        method: "POST",
        signal: timeoutSignal,
      }
    );
  } catch (error) {
    if (timeoutSignal.aborted) {
      throw new Error(
        `Runtime Decision proof through app proxy timed out after ${timeoutMs}ms.`,
        { cause: error }
      );
    }
    throw error;
  }

  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(
      `Runtime Decision proof failed through app proxy: ${JSON.stringify(body)}`
    );
  }

  const parsed = providerRoutineCallSuccessSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Runtime Decision proof through app proxy returned an invalid response: ${parsed.error.message}`
    );
  }

  const result = parsed.data;
  if (result.providerToolName !== RUNTIME_DECISION_TOOL_NAME) {
    throw new Error(
      `Runtime Decision proof returned ${result.providerToolName}, expected ${RUNTIME_DECISION_TOOL_NAME}.`
    );
  }

  const serialized = JSON.stringify(result.result);
  if (!serialized.includes(RUNTIME_DECISION_TOOL_NAME)) {
    throw new Error(
      `Linear runtime tool result did not include ${RUNTIME_DECISION_TOOL_NAME}: ${serialized}`
    );
  }
}

async function agentBrowser(config: DecisionsSmokeConfig, args: string[]) {
  return await runCommand("agent-browser", [
    "--session",
    config.sessionName,
    ...args,
  ]);
}

async function agentEval(config: DecisionsSmokeConfig, js: string) {
  return await agentBrowser(config, ["eval", js]);
}

async function signInWithClerkTicket(
  config: DecisionsSmokeConfig,
  input: { orgId: string; ticket: string }
) {
  await agentBrowser(config, ["open", `${config.appOrigin}/sign-in`]);
  await agentEval(
    config,
    `(async () => {
      const ticket = ${JSON.stringify(input.ticket)};
      const orgId = ${JSON.stringify(input.orgId)};
      const destination = ${JSON.stringify(`/${config.orgSlug}/decisions`)};
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
      window.location.assign(destination);
      return {
        orgId: window.Clerk.organization?.id ?? null,
        sessionId: window.Clerk.session?.id ?? null,
        status: signIn.status,
        userId: window.Clerk.user?.id ?? null,
      };
    })()`
  );
}

async function waitForUrl(
  config: DecisionsSmokeConfig,
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
      // Keep polling; agent-browser may briefly return intermediate text.
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

async function readBodyText(config: DecisionsSmokeConfig) {
  const raw = await agentEval(config, "document.body.innerText");
  return JSON.parse(raw) as string;
}

async function assertDecisionsRendered(config: DecisionsSmokeConfig) {
  const text = await readBodyText(config);
  const expected = [
    "Decisions",
    "Review recent integration work Lightfast performed for this team.",
    ...(config.runtimeDecisionEnabled
      ? [RUNTIME_DECISION_TOOL_NAME, "run_decisions_runtime_smoke"]
      : []),
    "sync_webhook_event",
    "Running",
    "list_issues",
    "Failed",
    "LINEAR_MCP_TIMEOUT",
    "create_issue",
    "Succeeded",
  ];
  const missing = expected.filter((value) => !text.includes(value));
  if (missing.length > 0) {
    throw new Error(
      `Decisions page did not render expected text: ${missing.join(", ")}\n${text}`
    );
  }
}

async function runCommand(command: string, args: string[]) {
  try {
    const result = await execFileAsync(command, args, {
      encoding: "utf8",
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

export function formatCommandForError(command: string, args: string[]) {
  const evalIndex = command === "agent-browser" ? args.indexOf("eval") : -1;
  if (evalIndex >= 0) {
    return `${command} ${[...args.slice(0, evalIndex + 1), "<script>"].join(" ")}`;
  }
  return `${command} ${args.join(" ")}`;
}

function readPortlessUrl(name: string): string {
  return trimTrailingSlash(
    execFileSync("pnpm", ["--silent", "exec", "portless", "get", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
  );
}

export async function runRealClerkDecisionsSmoke(
  input: BuildDecisionsSmokeConfigInput = {}
) {
  const config = buildDecisionsSmokeConfig(input);
  allowLocalhostTls(config.appOrigin);

  console.log(`[smoke] app=${config.appOrigin}`);
  console.log(`[smoke] org=${config.orgSlug}`);
  console.log(`[smoke] email=${config.emailAddress}`);

  try {
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
    let providerConnectionId = 0;
    if (config.runtimeDecisionEnabled) {
      providerConnectionId = await createActiveLinearRuntimeConnection({
        config,
        orgId: org.id,
        userId: user.id,
      });
      await recordRuntimeDecision({ config, orgId: org.id, userId: user.id });
    }
    await seedDecisionRows({
      orgId: org.id,
      providerConnectionId,
      userId: user.id,
    });

    const ticket = await createClerkSignInToken(config, user.id);
    await signInWithClerkTicket(config, { orgId: org.id, ticket });
    const finalUrl = await waitForUrl(
      config,
      (url) => url.pathname === `/${config.orgSlug}/decisions`,
      "Decisions page"
    );
    await delay(1500);
    await assertDecisionsRendered(config);

    if (config.screenshotPath) {
      await agentBrowser(config, ["screenshot", config.screenshotPath]);
      console.log(`[smoke] screenshot=${config.screenshotPath}`);
    }

    console.log(`[smoke] completed ${finalUrl.toString()}`);
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
  runRealClerkDecisionsSmoke().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
