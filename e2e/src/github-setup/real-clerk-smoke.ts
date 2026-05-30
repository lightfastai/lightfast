import { execFile, execFileSync } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { and, eq } from "drizzle-orm";

import {
  allowLocalhostTls,
  normalizeUrl,
  trimTrailingSlash,
} from "../helpers/env";

const execFileAsync = promisify(execFile);

const DEFAULT_SESSION_NAME = "lightfast-github-setup-smoke";
const EMULATOR_INSTALLATION_ID = "1001";
const EMULATOR_ORG_LOGIN = "lightfast-emulated";
const EMULATOR_TOKEN = "test_token_lightfast";

type Env = Record<string, string | undefined>;

export interface SmokeConfig {
  appOrigin: string;
  clerkUserId: string;
  githubOrigin: string;
  githubToken: string;
  orgSlug: string;
  sessionName: string;
}

export interface BuildSmokeConfigInput {
  env?: Env;
  getPortlessUrl?: (name: string) => string;
  nowMs?: number;
}

export function createUniqueOrgSlug(input: {
  nowMs?: number;
  prefix?: string;
}) {
  const prefix = (input.prefix ?? "lf-e2e")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  const timestampSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  return `${prefix || "lf-e2e"}-${timestampSeconds}`;
}

export function buildSmokeConfig(
  input: BuildSmokeConfigInput = {}
): SmokeConfig {
  const env = input.env ?? process.env;
  const getPortlessUrl = input.getPortlessUrl ?? readPortlessUrl;
  const clerkUserId = env.LIGHTFAST_E2E_CLERK_USER_ID?.trim();
  if (!clerkUserId) {
    throw new Error(
      "Set LIGHTFAST_E2E_CLERK_USER_ID=user_... before running the real Clerk GitHub setup smoke."
    );
  }

  return {
    appOrigin: normalizeUrl(
      env.LIGHTFAST_E2E_APP_URL?.trim() || getPortlessUrl("app.lightfast"),
      "LIGHTFAST_E2E_APP_URL"
    ),
    clerkUserId,
    githubOrigin: normalizeUrl(
      env.LIGHTFAST_E2E_GITHUB_URL?.trim() ||
        getPortlessUrl("github.lightfast"),
      "LIGHTFAST_E2E_GITHUB_URL"
    ),
    githubToken: env.LIGHTFAST_E2E_GITHUB_TOKEN?.trim() || EMULATOR_TOKEN,
    orgSlug:
      env.LIGHTFAST_E2E_ORG_SLUG?.trim() ||
      createUniqueOrgSlug({
        nowMs: input.nowMs,
        prefix: env.LIGHTFAST_E2E_ORG_SLUG_PREFIX,
      }),
    sessionName:
      env.LIGHTFAST_E2E_AGENT_BROWSER_SESSION?.trim() || DEFAULT_SESSION_NAME,
  };
}

async function cleanupLocalEmulatorBinding() {
  const [{ db }, { orgSourceControlBindings, sourceControlRepositories }] =
    await Promise.all([import("@db/app/client"), import("@db/app/schema")]);

  const bindings = await db
    .select({ id: orgSourceControlBindings.id })
    .from(orgSourceControlBindings)
    .where(
      and(
        eq(orgSourceControlBindings.provider, "github"),
        eq(
          orgSourceControlBindings.providerInstallationId,
          EMULATOR_INSTALLATION_ID
        ),
        eq(orgSourceControlBindings.providerAccountLogin, EMULATOR_ORG_LOGIN)
      )
    );

  for (const binding of bindings) {
    await db
      .delete(sourceControlRepositories)
      .where(
        eq(sourceControlRepositories.orgSourceControlBindingId, binding.id)
      );
    await db
      .delete(orgSourceControlBindings)
      .where(eq(orgSourceControlBindings.id, binding.id));
  }

  return bindings.length;
}

async function resetGitHubEmulator(config: SmokeConfig) {
  const res = await fetch(`${config.githubOrigin}/__lightfast/reset`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.githubToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(
      `GitHub emulator reset failed with HTTP ${res.status}: ${await res.text()}`
    );
  }
}

async function createLightfastRepo(config: SmokeConfig) {
  const res = await fetch(
    `${config.githubOrigin}/orgs/${EMULATOR_ORG_LOGIN}/repos`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.githubToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        auto_init: true,
        name: ".lightfast",
        private: true,
      }),
    }
  );
  if (!(res.status === 201 || res.status === 422)) {
    throw new Error(
      `Creating .lightfast in the GitHub emulator failed with HTTP ${res.status}: ${await res.text()}`
    );
  }
}

async function createClerkSignInToken(userId: string) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "CLERK_SECRET_KEY is missing. Run this script through `pnpm with-env` from @lightfast/e2e."
    );
  }

  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      expires_in_seconds: 600,
      user_id: userId,
    }),
  });
  const body = (await res.json()) as {
    errors?: Array<{ long_message?: string; message?: string }>;
    token?: string;
  };
  if (!(res.ok && body.token)) {
    const message =
      body.errors?.[0]?.long_message ??
      body.errors?.[0]?.message ??
      `HTTP ${res.status}`;
    throw new Error(`Failed to create Clerk sign-in token: ${message}`);
  }
  return body.token;
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

async function clickElementByText(config: SmokeConfig, text: string) {
  await agentEval(
    config,
    `(() => {
      const needle = ${JSON.stringify(text)};
      const target = Array.from(document.querySelectorAll("button,a")).find((element) =>
        (element.textContent || "").trim().includes(needle)
      );
      if (!target) {
        throw new Error("Could not find clickable element containing: " + needle);
      }
      target.click();
      return { clicked: true, text: target.textContent, url: location.href };
    })()`
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

async function signInWithClerkTicket(config: SmokeConfig, ticket: string) {
  await agentBrowser(config, ["open", `${config.appOrigin}/sign-in`]);
  await agentEval(
    config,
    `(async () => {
      const ticket = ${JSON.stringify(ticket)};
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
      await window.Clerk.setActive({ session: sessionId });
      return {
        signedIn: Boolean(window.Clerk.session?.id),
        status: signIn.status,
        userId: window.Clerk.user?.id,
      };
    })()`
  );
}

async function createTeam(config: SmokeConfig) {
  await agentBrowser(config, ["open", `${config.appOrigin}/account/teams/new`]);
  await agentBrowser(config, ["wait", "#teamSlug"]);
  await agentEval(
    config,
    `(() => {
      const slug = ${JSON.stringify(config.orgSlug)};
      const input = document.querySelector("#teamSlug");
      if (!(input instanceof HTMLInputElement)) {
        throw new Error("Team slug input was not found");
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, slug);
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: slug, inputType: "insertText" }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.form?.requestSubmit();
      return { slug };
    })()`
  );
  await waitForUrl(
    config,
    (url) => url.pathname === `/${config.orgSlug}/tasks/bind`,
    "new team setup bind page"
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
      `${command} ${args.join(" ")} failed:\n${
        failed.stderr || failed.stdout || failed.message
      }`
    );
  }
}

function readPortlessUrl(name: string): string {
  return trimTrailingSlash(
    execFileSync("pnpm", ["--silent", "exec", "portless", "get", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
  );
}

export async function runRealClerkGitHubSetupSmoke(
  input: BuildSmokeConfigInput = {}
) {
  const config = buildSmokeConfig(input);
  allowLocalhostTls(config.appOrigin);
  allowLocalhostTls(config.githubOrigin);

  console.log(`[smoke] app=${config.appOrigin}`);
  console.log(`[smoke] github=${config.githubOrigin}`);
  console.log(`[smoke] org=${config.orgSlug}`);

  await resetGitHubEmulator(config);
  const deletedBindings = await cleanupLocalEmulatorBinding();
  console.log(`[smoke] cleared emulator bindings=${deletedBindings}`);

  const ticket = await createClerkSignInToken(config.clerkUserId);
  await signInWithClerkTicket(config, ticket);
  await createTeam(config);

  await clickElementByText(config, "Connect GitHub organization");
  await waitForUrl(
    config,
    (url) => url.pathname === `/${config.orgSlug}/tasks/github/lightfast-repo`,
    ".lightfast repository setup page"
  );

  await clickElementByText(config, "Verify repository");
  await delay(1500);

  await createLightfastRepo(config);
  await clickElementByText(config, "Verify repository");
  const finalUrl = await waitForUrl(
    config,
    (url) => url.pathname === `/${config.orgSlug}`,
    "bound workspace root"
  );

  console.log(`[smoke] completed ${finalUrl.toString()}`);
}

function isMainModule() {
  const entrypoint = process.argv[1];
  return Boolean(
    entrypoint && path.resolve(entrypoint) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  runRealClerkGitHubSetupSmoke().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
