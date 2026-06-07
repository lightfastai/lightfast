import { execFile, execFileSync } from "node:child_process";
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

const DEFAULT_SESSION_NAME = "lightfast-x-connector-smoke";
const DEFAULT_CLERK_EMAIL = "lightfast-e2e-x-connector@example.com";
const LIGHTFAST_REPOSITORY_NAME = ".lightfast";

type Env = Record<string, string | undefined>;

interface AgentBrowserJsonResult<T> {
  data?: {
    result?: T;
  };
  error?: string | null;
  success: boolean;
}

interface ClerkErrorBody {
  errors?: Array<{ long_message?: string; message?: string }>;
}

interface ClerkUser {
  id?: string;
}

interface ClerkUserList {
  data?: ClerkUser[];
}

interface ClerkOrganization {
  public_metadata?: Record<string, unknown>;
}

interface BrowserOrgState {
  clerkOrgId: string;
  slug: string;
  userId: string;
}

export interface XConnectorSmokeConfig {
  appOrigin: string;
  clerkEmail: string;
  clerkUserId?: string;
  orgSlug: string;
  sessionName: string;
  xOrigin: string;
}

export interface BuildXConnectorSmokeConfigInput {
  env?: Env;
  getPortlessUrl?: (name: string) => string;
  nowMs?: number;
}

export function createUniqueXConnectorOrgSlug(input: {
  nowMs?: number;
  prefix?: string;
}) {
  const prefix = (input.prefix ?? "lf-e2e-x")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  const timestampMs = input.nowMs ?? Date.now();
  return `${prefix || "lf-e2e-x"}-${timestampMs}`;
}

export function resolveXConnectorClerkEmail(input: { env?: Env } = {}) {
  return input.env?.LIGHTFAST_E2E_CLERK_EMAIL?.trim() || DEFAULT_CLERK_EMAIL;
}

export function buildXConnectorSmokeConfig(
  input: BuildXConnectorSmokeConfigInput = {}
): XConnectorSmokeConfig {
  const env = input.env ?? process.env;
  const getPortlessUrl = input.getPortlessUrl ?? readPortlessUrl;

  return {
    appOrigin: normalizeUrl(
      env.LIGHTFAST_E2E_APP_URL?.trim() || getPortlessUrl("lightfast"),
      "LIGHTFAST_E2E_APP_URL"
    ),
    clerkEmail: resolveXConnectorClerkEmail({ env }),
    clerkUserId: env.LIGHTFAST_E2E_CLERK_USER_ID?.trim() || undefined,
    orgSlug:
      env.LIGHTFAST_E2E_ORG_SLUG?.trim() ||
      createUniqueXConnectorOrgSlug({
        nowMs: input.nowMs,
        prefix: env.LIGHTFAST_E2E_ORG_SLUG_PREFIX,
      }),
    sessionName:
      env.LIGHTFAST_E2E_AGENT_BROWSER_SESSION?.trim() || DEFAULT_SESSION_NAME,
    xOrigin: normalizeUrl(
      env.LIGHTFAST_E2E_X_URL?.trim() || getPortlessUrl("x.lightfast"),
      "LIGHTFAST_E2E_X_URL"
    ),
  };
}

async function clerkApi<T>(
  path: string,
  init: RequestInit & { expectedStatuses?: number[] } = {}
): Promise<T> {
  const expectedStatuses = init.expectedStatuses ?? [200];
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "CLERK_SECRET_KEY is missing. Run this script through `pnpm with-env` from @lightfast/e2e."
    );
  }

  const url = new URL(path.replace(/^\/+/, ""), "https://api.clerk.com/v1/");
  const res = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = parseJsonResponse(text, url.pathname);

  if (!expectedStatuses.includes(res.status)) {
    const errorBody = body as ClerkErrorBody;
    const message =
      errorBody.errors?.[0]?.long_message ??
      errorBody.errors?.[0]?.message ??
      `HTTP ${res.status}`;
    throw new Error(`Clerk API ${url.pathname} failed: ${message}`);
  }

  return body as T;
}

async function findClerkUserByEmail(email: string) {
  const params = new URLSearchParams();
  params.append("email_address", email);
  const body = await clerkApi<ClerkUserList | ClerkUser[]>(
    `/users?${params.toString()}`
  );
  const users = Array.isArray(body) ? body : (body.data ?? []);
  return users.find((user) => typeof user.id === "string");
}

async function createClerkUserByEmail(email: string) {
  const body = await clerkApi<ClerkUser>("/users", {
    body: JSON.stringify({
      email_address: [email],
      first_name: "Lightfast",
      last_name: "E2E",
      public_metadata: {
        lightfast: { e2e: true, smoke: "x-connector" },
      },
      skip_legal_checks: true,
      skip_password_checks: true,
      skip_password_requirement: true,
    }),
    expectedStatuses: [200, 201],
    method: "POST",
  });
  if (!body.id) {
    throw new Error("Clerk user creation did not return an id.");
  }
  return body.id;
}

async function resolveClerkUserId(config: XConnectorSmokeConfig) {
  if (config.clerkUserId) {
    return config.clerkUserId;
  }

  const existing = await findClerkUserByEmail(config.clerkEmail);
  if (existing?.id) {
    return existing.id;
  }

  try {
    return await createClerkUserByEmail(config.clerkEmail);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already|conflict|taken|exists/i.test(message)) {
      throw error;
    }
  }

  const recovered = await findClerkUserByEmail(config.clerkEmail);
  if (recovered?.id) {
    return recovered.id;
  }
  throw new Error(
    `Could not resolve or create Clerk user for ${config.clerkEmail}.`
  );
}

async function createClerkSignInToken(userId: string) {
  const body = await clerkApi<{ token?: string }>("/sign_in_tokens", {
    body: JSON.stringify({
      expires_in_seconds: 600,
      user_id: userId,
    }),
    expectedStatuses: [200, 201],
    method: "POST",
  });
  if (!body.token) {
    throw new Error("Clerk sign-in token creation did not return a token.");
  }
  return body.token;
}

async function updateClerkOrgBindingMetadata(clerkOrgId: string) {
  const org = await clerkApi<ClerkOrganization>(`/organizations/${clerkOrgId}`);
  const currentMetadata = record(org.public_metadata);
  const currentLightfast = record(currentMetadata.lightfast);
  await clerkApi(`/organizations/${clerkOrgId}`, {
    body: JSON.stringify({
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
    }),
    method: "PATCH",
  });
}

async function seedBoundOrgSetupGate(input: {
  clerkOrgId: string;
  orgSlug: string;
  userId: string;
}) {
  const [{ upsertActiveOrgBinding }, { db: appDb }] = await Promise.all([
    import("@db/app"),
    import("@db/app/client"),
  ]);
  const providerAccountLogin = input.orgSlug;
  const providerInstallationId = `x-smoke-${input.clerkOrgId}`;
  const verifiedAt = new Date().toISOString();

  await upsertActiveOrgBinding(appDb, {
    clerkOrgId: input.clerkOrgId,
    connectedByUserId: input.userId,
    metadata: {
      lightfastRepository: {
        fullName: `${providerAccountLogin}/${LIGHTFAST_REPOSITORY_NAME}`,
        id: `${providerInstallationId}-repo`,
        installationId: providerInstallationId,
        name: LIGHTFAST_REPOSITORY_NAME,
        verifiedAt,
      },
    },
    provider: "github",
    providerAccountId: providerInstallationId,
    providerAccountLogin,
    providerInstallationId,
  });
}

async function agentBrowser(
  config: XConnectorSmokeConfig,
  args: string[],
  options: { json?: boolean } = {}
) {
  return await runCommand("agent-browser", [
    ...(options.json ? ["--json"] : []),
    "--session",
    config.sessionName,
    ...args,
  ]);
}

async function agentEval(config: XConnectorSmokeConfig, js: string) {
  return await agentBrowser(config, ["eval", js]);
}

async function agentEvalJson<T>(config: XConnectorSmokeConfig, js: string) {
  const output = await agentBrowser(config, ["eval", js], { json: true });
  const parsed = JSON.parse(output) as AgentBrowserJsonResult<T>;
  if (!parsed.success) {
    throw new Error(parsed.error ?? "agent-browser eval failed.");
  }
  return parsed.data?.result as T;
}

async function signInWithClerkTicket(
  config: XConnectorSmokeConfig,
  ticket: string
) {
  await agentBrowser(config, ["open", `${config.appOrigin}/sign-in`]);
  await agentEval(
    config,
    `(() => {
      const ticket = ${JSON.stringify(ticket)};
      window.__lightfastTicketSignIn = { error: null, started: true };
      void (async () => {
        for (let attempt = 0; attempt < 300; attempt += 1) {
          if (window.Clerk?.session?.id) {
            window.__lightfastTicketSignIn = { done: true, error: null, started: true };
            return;
          }
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
        await window.Clerk.setActive({ session: sessionId });
        window.__lightfastTicketSignIn = {
          done: true,
          error: null,
          signedIn: Boolean(window.Clerk.session?.id),
          started: true,
          status: signIn.status,
          userId: window.Clerk.user?.id,
        };
      })().catch((error) => {
        window.__lightfastTicketSignIn = {
          done: true,
          error: error instanceof Error ? error.message : String(error),
          started: true,
        };
      });
      return { started: true };
    })()`
  );

  const signedIn = await waitForBrowserSignedIn(config, 60_000);
  if (!signedIn) {
    throw new Error("Clerk ticket sign-in did not activate.");
  }
}

async function waitForBrowserSignedIn(
  config: XConnectorSmokeConfig,
  timeoutMs = 30_000
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const currentUrl = await agentBrowser(config, ["get", "url"]).catch(
      () => ""
    );
    try {
      const parsed = new URL(currentUrl);
      if (parsed.pathname !== "/sign-in") {
        return true;
      }
    } catch {
      // Keep polling while the browser is between navigations.
    }

    const result = await agentEvalJson<{
      error?: string | null;
      signedIn: boolean;
    }>(
      config,
      `(() => ({
        error: window.__lightfastTicketSignIn?.error ?? null,
        signedIn: Boolean(window.Clerk?.session?.id),
      }))()`
    ).catch(() => undefined);
    if (result?.error) {
      throw new Error(`Clerk ticket sign-in failed: ${result.error}`);
    }
    if (result?.signedIn) {
      return true;
    }
    await delay(1000);
  }
  return false;
}

async function createTeam(config: XConnectorSmokeConfig) {
  await agentBrowser(config, ["open", `${config.appOrigin}/account/teams/new`]);
  await agentBrowser(config, ["wait", "#teamSlug"]);
  await agentBrowser(config, ["wait", "--load", "networkidle"]);
  await agentBrowser(config, [
    "find",
    "label",
    "Your Team Name",
    "fill",
    config.orgSlug,
  ]);
  const value = await readTeamSlugInputValue(config);
  if (value !== config.orgSlug) {
    throw new Error(
      `Team slug input did not fill. Expected ${config.orgSlug}, got ${value ?? "<empty>"}.`
    );
  }
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
    (url) => url.pathname === `/${config.orgSlug}/tasks/bind`,
    "new team setup bind page"
  );
}

async function readTeamSlugInputValue(config: XConnectorSmokeConfig) {
  const result = await agentEvalJson<{ value?: string }>(
    config,
    `(() => ({ value: document.querySelector("#teamSlug")?.value }))()`
  );
  return result.value;
}

async function waitForActiveBrowserOrg(config: XConnectorSmokeConfig) {
  return await agentEvalJson<BrowserOrgState>(
    config,
    `(async () => {
      const expectedSlug = ${JSON.stringify(config.orgSlug)};
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const org = window.Clerk?.organization;
        const user = window.Clerk?.user;
        if (org?.id && user?.id && org.slug === expectedSlug) {
          return { clerkOrgId: org.id, slug: org.slug, userId: user.id };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Active Clerk organization was not available in the browser");
    })()`
  );
}

async function refreshActiveBrowserOrg(
  config: XConnectorSmokeConfig,
  clerkOrgId: string
) {
  await agentEval(
    config,
    `(async () => {
      const clerkOrgId = ${JSON.stringify(clerkOrgId)};
      if (!window.Clerk?.setActive) {
        throw new Error("Clerk did not load");
      }
      await window.Clerk.setActive({ organization: null }).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await window.Clerk.setActive({ organization: clerkOrgId });
      if (typeof window.Clerk.session?.reload === "function") {
        await window.Clerk.session.reload();
      }
      return {
        orgId: window.Clerk.organization?.id,
        signedIn: Boolean(window.Clerk.session?.id),
      };
    })()`
  );
}

async function openConnectorsPage(config: XConnectorSmokeConfig) {
  const connectorCatalogPath = `/${config.orgSlug}/connectors`;
  const xConnectorTaskPath = `/${config.orgSlug}/tasks/connectors/x`;
  await agentBrowser(config, [
    "open",
    `${config.appOrigin}${connectorCatalogPath}`,
  ]);
  const url = await waitForUrl(
    config,
    (currentUrl) =>
      currentUrl.pathname === connectorCatalogPath ||
      currentUrl.pathname === xConnectorTaskPath,
    "X connector entry page"
  );
  if (url.searchParams.has("error")) {
    throw new Error(
      `Connectors page opened with error=${url.searchParams.get("error")}`
    );
  }
  await waitForBrowserText(
    config,
    url.pathname === xConnectorTaskPath ? ["Connect X"] : ["Connectors", "X"],
    url.pathname === xConnectorTaskPath
      ? "X connector setup task"
      : "connectors catalog"
  );
}

async function clickXConnect(config: XConnectorSmokeConfig) {
  await agentEval(
    config,
    `(() => {
      const setupButton = Array.from(document.querySelectorAll("button")).find((candidate) =>
        /^connect x$/i.test((candidate.textContent || "").trim())
      );
      if (setupButton) {
        if (setupButton.disabled) {
          throw new Error("X connector setup button is disabled");
        }
        setupButton.click();
        return { clicked: true, source: "setup-task" };
      }

      const card = Array.from(document.querySelectorAll("section")).find((section) =>
        Array.from(section.querySelectorAll("h2")).some((heading) =>
          (heading.textContent || "").trim() === "X"
        )
      );
      if (!card) {
        throw new Error("X connector card was not found");
      }
      const button = Array.from(card.querySelectorAll("button")).find((candidate) =>
        /connect|reconnect/i.test(candidate.textContent || "")
      );
      if (!button) {
        throw new Error("X connector connect button was not found");
      }
      if (button.disabled) {
        throw new Error("X connector connect button is disabled");
      }
      button.click();
      return { clicked: true };
    })()`
  );
}

async function waitForSuccessfulConnectorCallback(
  config: XConnectorSmokeConfig
) {
  const connectorCatalogPath = `/${config.orgSlug}/connectors`;
  const xConnectorCompletePath = `/${config.orgSlug}/tasks/connectors/x/complete`;
  const workspaceRootPath = `/${config.orgSlug}`;
  const url = await waitForUrl(
    config,
    (currentUrl) =>
      (currentUrl.pathname === connectorCatalogPath &&
        currentUrl.searchParams.get("connector") === "x") ||
      currentUrl.pathname === xConnectorCompletePath ||
      currentUrl.pathname === workspaceRootPath,
    "successful X connector callback"
  );
  const error = url.searchParams.get("error");
  if (error) {
    throw new Error(`X connector callback failed with error=${error}`);
  }
  return url;
}

async function waitForXConnection(input: {
  appOrigin: string;
  clerkOrgId: string;
}) {
  const [{ getCurrentOrgConnectorConnection }, { db: appDb }] =
    await Promise.all([import("@db/app"), import("@db/app/client")]);
  const deadline = Date.now() + 60_000;
  let lastTools: string[] = [];

  while (Date.now() < deadline) {
    const connection = await getCurrentOrgConnectorConnection(appDb, {
      clerkOrgId: input.clerkOrgId,
      provider: "x",
    });
    lastTools = connection?.toolManifest.map((tool) => tool.name) ?? [];

    if (
      connection?.status === "active" &&
      connection.enabledForAutomations &&
      connection.mcpEndpoint === `${input.appOrigin}/api/connectors/x/mcp` &&
      lastTools.includes("getUsersMe") &&
      lastTools.includes("getUsersByUsername")
    ) {
      return connection;
    }

    await delay(1000);
  }

  throw new Error(
    `Timed out waiting for active X connector connection. Last tools: ${lastTools.join(", ")}`
  );
}

async function waitForBrowserText(
  config: XConnectorSmokeConfig,
  needles: string[],
  description: string,
  timeoutMs = 60_000
) {
  const deadline = Date.now() + timeoutMs;
  let lastText = "";

  while (Date.now() < deadline) {
    const result = await agentEvalJson<{ found: boolean; text: string }>(
      config,
      `(() => {
        const needles = ${JSON.stringify(needles)};
        const text = document.body?.innerText || "";
        return {
          found: needles.every((needle) => text.includes(needle)),
          text: text.slice(0, 1000),
        };
      })()`
    );
    lastText = result.text;
    if (result.found) {
      return;
    }
    await delay(1000);
  }

  throw new Error(
    `Timed out waiting for ${description}. Last page text:\n${lastText}`
  );
}

async function waitForUrl(
  config: XConnectorSmokeConfig,
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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseJsonResponse(text: string, pathName: string): unknown {
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const preview = text.replace(/\s+/g, " ").slice(0, 200);
    throw new Error(
      `Clerk API ${pathName} returned invalid JSON: ${preview || String(error)}`
    );
  }
}

export async function runXConnectorLocalAgentSmoke(
  input: BuildXConnectorSmokeConfigInput = {}
) {
  const config = buildXConnectorSmokeConfig(input);
  allowLocalhostTls(config.appOrigin);
  allowLocalhostTls(config.xOrigin);

  console.log(`[smoke] app=${config.appOrigin}`);
  console.log(`[smoke] x=${config.xOrigin}`);
  console.log(`[smoke] org=${config.orgSlug}`);

  await agentBrowser(config, ["close"]).catch(() => undefined);

  const clerkUserId = await resolveClerkUserId(config);
  console.log(`[smoke] clerkUser=${clerkUserId}`);

  const ticket = await createClerkSignInToken(clerkUserId);
  await signInWithClerkTicket(config, ticket);
  await createTeam(config);

  const browserOrg = await waitForActiveBrowserOrg(config);
  await seedBoundOrgSetupGate({
    clerkOrgId: browserOrg.clerkOrgId,
    orgSlug: browserOrg.slug,
    userId: browserOrg.userId,
  });
  await updateClerkOrgBindingMetadata(browserOrg.clerkOrgId);
  await refreshActiveBrowserOrg(config, browserOrg.clerkOrgId);

  await openConnectorsPage(config);
  await clickXConnect(config);
  const callbackUrl = await waitForSuccessfulConnectorCallback(config);
  const connection = await waitForXConnection({
    appOrigin: config.appOrigin,
    clerkOrgId: browserOrg.clerkOrgId,
  });
  await openConnectorsPage(config);
  await waitForBrowserText(
    config,
    ["Connected", "getUsersMe", "getUsersByUsername"],
    "connected X tool list"
  );

  console.log(`[smoke] callback=${callbackUrl.toString()}`);
  console.log(`[smoke] connection=${connection.id}`);
  console.log(
    `[smoke] tools=${connection.toolManifest.map((tool) => tool.name).join(",")}`
  );
}

function isMainModule() {
  const entrypoint = process.argv[1];
  return Boolean(
    entrypoint && path.resolve(entrypoint) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  runXConnectorLocalAgentSmoke().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
