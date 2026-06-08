import { execFile, execFileSync } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { CreateAutomationInput } from "@db/app";

import {
  allowLocalhostTls,
  normalizeUrl,
  trimTrailingSlash,
} from "../helpers/env";

const execFileAsync = promisify(execFile);

const DEFAULT_SESSION_NAME = "lightfast-app-tanstack-auth-smoke";
const DEFAULT_EMAIL_DOMAIN = "lightfast.ai";
const APP_TANSTACK_PORTLESS_NAME = "app-tanstack.lightfast";
const DEFAULT_CLERK_API_TIMEOUT_MS = 30_000;
const DEFAULT_ROUTE_TIMEOUT_MS = 120_000;
const X_EMULATOR_ACCESS_TOKEN = "x_access_valid";
const X_EMULATOR_REFRESH_TOKEN = "x_refresh_valid";
const X_EMULATOR_TOOL_NAME = "getUsersMe";
const SMOKE_AUTOMATION_NAME = "Daily smoke automation";
const SMOKE_AUTOMATION_PROMPT = "Review seeded route smoke coverage.";

type Env = Record<string, string | undefined>;

export interface AppTanstackAuthRouteSmokeConfig {
  appOrigin: string;
  clerkApiTimeoutMs: number;
  clerkSecretKey: string;
  emailAddress: string;
  orgSlug: string;
  routeTimeoutMs: number;
  sessionName: string;
}

export interface BuildAppTanstackAuthRouteSmokeConfigInput {
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

interface RouteSpec {
  expectedText: string[];
  name: string;
  pathTemplate: string;
}

interface RouteCheck {
  expectedText: string[];
  name: string;
  path: string;
}

interface RouteFixtureIds {
  automationId?: string;
}

interface RouteBodyProblemInput {
  bodyText: string;
  expectedText: string[];
  finalPathname: string;
  routeName: string;
  routePath: string;
}

const FORBIDDEN_ROUTE_TEXT = [
  "Log in to Lightfast",
  "Create your account",
  "Organization setup required",
  "Team not found",
  "Application Error",
  "Something went wrong",
  "Unable to load",
  "Failed to load",
  "UNAUTHORIZED",
  "Authentication required",
  "Session expired",
] as const;

export const APP_TANSTACK_AUTH_ROUTE_SPECS: RouteSpec[] = [
  {
    expectedText: ["General", "Profile", "Display name"],
    name: "account general settings",
    pathTemplate: "/account/settings/general",
  },
  {
    expectedText: ["Source Control & Git", "No GitHub account connected"],
    name: "account source control settings",
    pathTemplate: "/account/settings/source-control",
  },
  {
    expectedText: ["MCP Connections", "Manage MCP clients authorized"],
    name: "account mcp connections",
    pathTemplate: "/account/mcp",
  },
  {
    expectedText: ["Connect your GitHub account", "Link your personal GitHub"],
    name: "account github task",
    pathTemplate: "/account/tasks/github",
  },
  {
    expectedText: ["Choose your username", "Username"],
    name: "account username task",
    pathTemplate: "/account/tasks/username?return_to=%2Faccount%2Fteams%2Fnew",
  },
  {
    expectedText: ["Create your team", "Your Team Name"],
    name: "create team",
    pathTemplate: "/account/teams/new",
  },
  {
    expectedText: ["Signals", "Add Signal"],
    name: "signals",
    pathTemplate: "/$slug/signals",
  },
  {
    expectedText: ["Make Lightfast work your way", "No skills indexed."],
    name: "skills",
    pathTemplate: "/$slug/skills",
  },
  {
    expectedText: ["Automations", "New automation"],
    name: "automations",
    pathTemplate: "/$slug/automations",
  },
  {
    expectedText: ["New automation", "Name", "Instructions", "Schedule"],
    name: "new automation",
    pathTemplate: "/$slug/automations/new",
  },
  {
    expectedText: ["Ready when you are."],
    name: "chat",
    pathTemplate: "/$slug/chat",
  },
  {
    expectedText: ["Connectors", "Team connectors"],
    name: "connectors",
    pathTemplate: "/$slug/connectors",
  },
  {
    expectedText: ["Decisions", "No decisions yet"],
    name: "decisions",
    pathTemplate: "/$slug/decisions",
  },
  {
    expectedText: ["Developer Connections", "Connect provider CLIs"],
    name: "developer connections",
    pathTemplate: "/$slug/developer-connections",
  },
  {
    expectedText: ["People", "No people yet"],
    name: "people",
    pathTemplate: "/$slug/people",
  },
  {
    expectedText: ["General", "Profile"],
    name: "org general settings",
    pathTemplate: "/$slug/settings/general",
  },
  {
    expectedText: ["Source Control & Git"],
    name: "org source control settings",
    pathTemplate: "/$slug/settings/source-control",
  },
  {
    expectedText: ["Members", "Manage the people"],
    name: "org members settings",
    pathTemplate: "/$slug/settings/members",
  },
  {
    expectedText: ["Billing", "Payment", "Invoices"],
    name: "org billing settings",
    pathTemplate: "/$slug/settings/billing",
  },
  {
    expectedText: ["API Keys", "No API keys yet"],
    name: "org api keys settings",
    pathTemplate: "/$slug/settings/api-keys",
  },
  {
    expectedText: ["MCP Connections", "No MCP connections"],
    name: "org mcp settings",
    pathTemplate: "/$slug/settings/mcp",
  },
];

const APP_TANSTACK_AUTH_FIXTURE_ROUTE_SPECS: Array<
  RouteSpec & { fixture: keyof RouteFixtureIds }
> = [
  {
    expectedText: [
      SMOKE_AUTOMATION_NAME,
      SMOKE_AUTOMATION_PROMPT,
      "Status",
      "Previous runs",
    ],
    fixture: "automationId",
    name: "automation detail",
    pathTemplate: "/$slug/automations/$automation",
  },
];

export function createUniqueAppTanstackAuthOrgSlug(input: {
  nowMs?: number;
  prefix?: string;
}) {
  const prefix = slugPart(input.prefix ?? "lf-app-tanstack-auth-e2e");
  const timestampMs = input.nowMs ?? Date.now();
  return `${prefix || "lf-app-tanstack-auth-e2e"}-${timestampMs}`;
}

export function buildAppTanstackAuthRouteSmokeConfig(
  input: BuildAppTanstackAuthRouteSmokeConfigInput = {}
): AppTanstackAuthRouteSmokeConfig {
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
    env.LIGHTFAST_E2E_APP_TANSTACK_AUTH_ORG_SLUG?.trim() ||
    createUniqueAppTanstackAuthOrgSlug({
      nowMs,
      prefix: env.LIGHTFAST_E2E_APP_TANSTACK_AUTH_ORG_SLUG_PREFIX,
    });
  const emailAddress =
    env.LIGHTFAST_E2E_APP_TANSTACK_AUTH_EMAIL?.trim() ||
    `${slugPart(
      env.LIGHTFAST_E2E_APP_TANSTACK_AUTH_EMAIL_PREFIX ??
        "app-tanstack-auth-smoke"
    )}-${nowMs}@${DEFAULT_EMAIL_DOMAIN}`;
  const routeTimeoutMs = readPositiveInteger(
    env.LIGHTFAST_E2E_APP_TANSTACK_AUTH_ROUTE_TIMEOUT_MS,
    DEFAULT_ROUTE_TIMEOUT_MS,
    "LIGHTFAST_E2E_APP_TANSTACK_AUTH_ROUTE_TIMEOUT_MS"
  );
  const clerkApiTimeoutMs = readPositiveInteger(
    env.LIGHTFAST_E2E_APP_TANSTACK_AUTH_CLERK_API_TIMEOUT_MS,
    DEFAULT_CLERK_API_TIMEOUT_MS,
    "LIGHTFAST_E2E_APP_TANSTACK_AUTH_CLERK_API_TIMEOUT_MS"
  );

  return {
    appOrigin: normalizeUrl(
      env.LIGHTFAST_E2E_APP_TANSTACK_URL?.trim() ||
        env.LIGHTFAST_E2E_APP_URL?.trim() ||
        getPortlessUrl(APP_TANSTACK_PORTLESS_NAME),
      "LIGHTFAST_E2E_APP_TANSTACK_URL"
    ),
    clerkApiTimeoutMs,
    clerkSecretKey,
    emailAddress,
    orgSlug,
    routeTimeoutMs,
    sessionName:
      env.LIGHTFAST_E2E_AGENT_BROWSER_SESSION?.trim() ||
      `${DEFAULT_SESSION_NAME}-${nowMs}`,
  };
}

export function buildRouteChecks(
  orgSlug: string,
  fixtures: RouteFixtureIds = {}
): RouteCheck[] {
  const staticChecks = APP_TANSTACK_AUTH_ROUTE_SPECS.map((spec) =>
    buildRouteCheck(spec, orgSlug, fixtures)
  );
  const fixtureChecks = APP_TANSTACK_AUTH_FIXTURE_ROUTE_SPECS.filter((spec) =>
    Boolean(fixtures[spec.fixture])
  ).map((spec) => buildRouteCheck(spec, orgSlug, fixtures));
  return [...staticChecks, ...fixtureChecks];
}

function buildRouteCheck(
  spec: RouteSpec,
  orgSlug: string,
  fixtures: RouteFixtureIds
): RouteCheck {
  return {
    expectedText: spec.expectedText,
    name: spec.name,
    path: spec.pathTemplate
      .replaceAll("$slug", orgSlug)
      .replaceAll("$automation", fixtures.automationId ?? ""),
  };
}

export function buildAppTanstackAuthSmokeAutomationInput(input: {
  orgId: string;
  userId: string;
}): CreateAutomationInput {
  return {
    clerkOrgId: input.orgId,
    connectorProvider: null,
    createdByUserId: input.userId,
    name: SMOKE_AUTOMATION_NAME,
    prompt: SMOKE_AUTOMATION_PROMPT,
    schedule: { kind: "daily", config: { time: "09:00" } },
    timezone: "UTC",
  };
}

export function collectRouteBodyProblems(input: RouteBodyProblemInput) {
  const problems: string[] = [];
  const expectedPathname = new URL(input.routePath, "https://lightfast.local")
    .pathname;
  if (input.finalPathname !== expectedPathname) {
    problems.push(
      `${input.routeName} landed on ${input.finalPathname} instead of ${expectedPathname}`
    );
  }

  for (const forbidden of FORBIDDEN_ROUTE_TEXT) {
    if (input.bodyText.includes(forbidden)) {
      problems.push(`${input.routeName} rendered forbidden text: ${forbidden}`);
    }
  }

  const missing = input.expectedText.filter(
    (text) => !input.bodyText.includes(text)
  );
  if (missing.length > 0) {
    problems.push(
      `${input.routeName} did not render expected text: ${missing.join(", ")}`
    );
  }
  return problems;
}

export function combineRouteTextForSmoke(input: {
  bodyText: string;
  formControlValues?: string[];
}) {
  return [input.bodyText, ...(input.formControlValues ?? [])]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
}

function slugPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function readPositiveInteger(
  raw: string | undefined,
  fallback: number,
  name: string
) {
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
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
  config: AppTanstackAuthRouteSmokeConfig,
  path: `/${string}`,
  init: Omit<RequestInit, "body" | "headers"> & {
    body?: Record<string, unknown>;
  }
): Promise<T> {
  const timeoutSignal = AbortSignal.timeout(config.clerkApiTimeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    body: init.body ? JSON.stringify(init.body) : undefined,
    headers: {
      authorization: `Bearer ${config.clerkSecretKey}`,
      "content-type": "application/json",
    },
    signal,
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

async function createClerkUser(config: AppTanstackAuthRouteSmokeConfig) {
  return await fetchClerkJson<ClerkUser>(config, "/users", {
    body: {
      email_address: [config.emailAddress],
      first_name: "TanStack",
      last_name: "Smoke",
      legal_accepted_at: new Date().toISOString(),
    },
    method: "POST",
  });
}

async function createClerkOrganization(
  config: AppTanstackAuthRouteSmokeConfig,
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
  config: AppTanstackAuthRouteSmokeConfig,
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

async function updateClerkOrgBoundMetadata(
  config: AppTanstackAuthRouteSmokeConfig,
  orgId: string
) {
  const org = await fetchClerkJson<{
    public_metadata?: Record<string, unknown>;
  }>(config, `/organizations/${orgId}`, {
    method: "GET",
  });
  const currentMetadata = record(org.public_metadata);
  const currentLightfast = record(currentMetadata.lightfast);

  await fetchClerkJson(config, `/organizations/${orgId}`, {
    body: {
      public_metadata: {
        ...currentMetadata,
        lightfast: {
          ...currentLightfast,
          binding: {
            provider: "github",
            status: "bound",
            updatedAt: new Date().toISOString(),
          },
        },
      },
    },
    method: "PATCH",
  });
}

async function createClerkSignInToken(
  config: AppTanstackAuthRouteSmokeConfig,
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

export function readAppTanstackAuthEncryptionKey(env: Env = process.env) {
  const value = env.ENCRYPTION_KEY?.trim();
  if (!value) {
    throw new Error(
      "ENCRYPTION_KEY is missing. Run this script through `pnpm with-env` from @lightfast/e2e."
    );
  }
  return value;
}

async function createBoundSourceControlBinding(input: {
  orgId: string;
  orgSlug: string;
  userId: string;
}) {
  const [
    { db },
    { finalizeActiveOrgProviderBinding, upsertWatchedSourceControlRepository },
  ] = await Promise.all([import("@db/app/client"), import("@db/app")]);
  const installationId = `install-${input.orgSlug}`;
  const lightfastRepository = {
    fullName: `${input.orgSlug}/.lightfast`,
    id: `repo-${input.orgSlug}`,
    installationId,
    name: ".lightfast",
    verifiedAt: new Date().toISOString(),
  };
  const binding = await finalizeActiveOrgProviderBinding(db, {
    clerkOrgId: input.orgId,
    connectedByUserId: input.userId,
    metadata: {
      lightfastRepository,
    },
    provider: "github",
    providerAccountId: `acct-${input.orgSlug}`,
    providerAccountLogin: input.orgSlug,
    providerInstallationId: installationId,
  });
  await upsertWatchedSourceControlRepository(db, {
    fullName: lightfastRepository.fullName,
    orgSourceControlBindingId: binding.id,
    providerRepositoryId: lightfastRepository.id,
    watchedPathGlobs: ["skills/**"],
    watchedWebhookEvents: [],
  });
}

async function createActiveXConnectorConnection(input: {
  config: AppTanstackAuthRouteSmokeConfig;
  env: Env;
  orgId: string;
  orgSlug: string;
  userId: string;
}) {
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
  const encryptionKey = readAppTanstackAuthEncryptionKey(input.env);

  await finalizeCurrentOrgConnectorConnection(db, {
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    clerkOrgId: input.orgId,
    connectedByUserId: input.userId,
    encryptedAccessToken: await encrypt(X_EMULATOR_ACCESS_TOKEN, encryptionKey),
    encryptedRefreshToken: await encrypt(
      X_EMULATOR_REFRESH_TOKEN,
      encryptionKey
    ),
    enabledForAutomations: true,
    lastToolRefreshAt: new Date(),
    mcpEndpoint: new URL(
      "/api/connectors/x/mcp",
      input.config.appOrigin
    ).toString(),
    metadata: {
      smoke: "app-tanstack-auth-routes",
      username: input.orgSlug,
    },
    provider: "x",
    providerActorId: `x-${input.orgSlug}`,
    providerActorName: `@${input.orgSlug}`,
    providerWorkspaceId: null,
    providerWorkspaceName: "X",
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    scopes: ["tweet.read", "users.read", "offline.access"],
    toolManifest: [
      {
        description: "Emulated X profile lookup",
        inputSchema: { additionalProperties: true, type: "object" },
        name: X_EMULATOR_TOOL_NAME,
      },
    ],
  });
  await setConnectorAgentEnabled(db, {
    clerkOrgId: input.orgId,
    enabled: true,
    provider: "x",
  });
  await setConnectorAutomationEnabled(db, {
    clerkOrgId: input.orgId,
    enabled: true,
    provider: "x",
  });
}

async function createSmokeAutomation(input: { orgId: string; userId: string }) {
  const [{ db }, { createAutomation }] = await Promise.all([
    import("@db/app/client"),
    import("@db/app"),
  ]);
  const automation = await createAutomation(
    db,
    buildAppTanstackAuthSmokeAutomationInput(input)
  );
  return automation.publicId;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function agentBrowser(
  config: AppTanstackAuthRouteSmokeConfig,
  args: string[]
) {
  return await runCommand("agent-browser", [
    "--session",
    config.sessionName,
    ...args,
  ]);
}

async function agentEval(config: AppTanstackAuthRouteSmokeConfig, js: string) {
  return await agentBrowser(config, ["eval", js]);
}

async function signInWithClerkTicket(
  config: AppTanstackAuthRouteSmokeConfig,
  input: { destinationPath: string; orgId: string; ticket: string }
) {
  await agentBrowser(config, ["open", `${config.appOrigin}/sign-in`]);
  await agentEval(
    config,
    `(async () => {
      const ticket = ${JSON.stringify(input.ticket)};
      const orgId = ${JSON.stringify(input.orgId)};
      const destination = ${JSON.stringify(input.destinationPath)};
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

async function readPageState(config: AppTanstackAuthRouteSmokeConfig) {
  const raw = await agentEval(
    config,
    `({
      bodyText: document.body.innerText,
      formControlValues: Array.from(
        document.querySelectorAll("input, textarea, select")
      )
        .map((element) => "value" in element ? String(element.value) : "")
        .filter(Boolean),
      href: location.href,
      pathname: location.pathname,
    })`
  );
  const state = JSON.parse(raw) as {
    bodyText: string;
    formControlValues: string[];
    href: string;
    pathname: string;
  };
  return {
    bodyText: combineRouteTextForSmoke(state),
    href: state.href,
    pathname: state.pathname,
  };
}

async function assertRouteRendered(
  config: AppTanstackAuthRouteSmokeConfig,
  route: RouteCheck
) {
  const targetUrl = new URL(route.path, config.appOrigin);
  await agentBrowser(config, ["open", targetUrl.toString()]);

  const deadline = Date.now() + config.routeTimeoutMs;
  let latestState:
    | {
        bodyText: string;
        href: string;
        pathname: string;
      }
    | undefined;
  let latestProblems: string[] = [];

  while (Date.now() < deadline) {
    latestState = await readPageState(config);
    latestProblems = collectRouteBodyProblems({
      bodyText: latestState.bodyText,
      expectedText: route.expectedText,
      finalPathname: latestState.pathname,
      routeName: route.name,
      routePath: route.path,
    });
    if (latestProblems.length === 0) {
      console.log(`[smoke] ok ${route.path}`);
      return;
    }
    await delay(1000);
  }

  const snapshot = await agentBrowser(config, ["snapshot", "-i", "-u"]).catch(
    (error) => String(error)
  );
  throw new Error(
    [
      `Route smoke failed for ${route.name} (${route.path}).`,
      ...latestProblems,
      latestState ? `Last URL: ${latestState.href}` : "Last URL: <unknown>",
      snapshot,
    ].join("\n")
  );
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

export async function runAppTanstackAuthRouteSmoke(
  input: BuildAppTanstackAuthRouteSmokeConfigInput = {}
) {
  const env = input.env ?? process.env;
  const config = buildAppTanstackAuthRouteSmokeConfig(input);
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
    await createActiveXConnectorConnection({
      config,
      env,
      orgId: org.id,
      orgSlug: config.orgSlug,
      userId: user.id,
    });
    await updateClerkOrgBoundMetadata(config, org.id);
    const automationId = await createSmokeAutomation({
      orgId: org.id,
      userId: user.id,
    });
    const routes = buildRouteChecks(config.orgSlug, { automationId });
    console.log(`[smoke] routes=${routes.length}`);

    const ticket = await createClerkSignInToken(config, user.id);
    await signInWithClerkTicket(config, {
      destinationPath: routes[0]?.path ?? "/account/settings/general",
      orgId: org.id,
      ticket,
    });

    for (const route of routes) {
      await assertRouteRendered(config, route);
    }

    console.log(`[smoke] completed ${routes.length} routes`);
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
  runAppTanstackAuthRouteSmoke().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
