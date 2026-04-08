/**
 * Process OAuth callback — the heavyweight OAuth completion logic.
 *
 * Ported from apps/gateway/src/routes/connections.ts (lines 208-489).
 * Returns structured CallbackProcessResult instead of HTTP responses.
 * The Route Handler maps CallbackProcessResult to NextResponse.redirect / HTML.
 */
import { db } from "@db/app/client";
import { gatewayInstallations } from "@db/app/schema";
import type { SourceType } from "@repo/app-providers";
import { getProvider, providerAccountInfoSchema } from "@repo/app-providers";
import { and, eq } from "@vendor/db";
import { log } from "@vendor/observability/log/next";
import { providerConfigs } from "../provider-configs";
import { writeTokenRecord } from "../token-store";
import { consumeOAuthState, storeOAuthResult } from "./state";

// ── App URL ──

/**
 * App URL for redirects.
 */
const appUrl = (() => {
  const vercelEnv = process.env.VERCEL_ENV;
  const vercelUrl = process.env.VERCEL_URL;
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (vercelEnv === "preview" && vercelUrl) {
    return `https://${vercelUrl}`;
  }

  if (productionUrl) {
    return `https://${productionUrl}`;
  }

  return "http://localhost:3024";
})();

// ── Result Types ──

/**
 * Structured result from processing an OAuth callback.
 * The Route Handler maps this to NextResponse.redirect() or HTML response.
 */
export type CallbackProcessResult =
  | { kind: "redirect"; url: string }
  | { kind: "inline_html"; html: string; status?: number }
  | { kind: "error"; error: string; status: number };

// ── Inline HTML Templates ──

function successHtml(providerName: string): string {
  return `<!doctype html>
<html>
  <head><title>Connected</title></head>
  <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa">
    <div style="text-align:center">
      <div style="font-size:48px;margin-bottom:16px">&#10003;</div>
      <h1 style="margin:0 0 8px">Connected to ${providerName}!</h1>
      <p style="color:#666">You can close this tab and return to your terminal.</p>
    </div>
    <script>setTimeout(()=>window.close(),2000)</script>
  </body>
</html>`;
}

function errorHtml(message: string): string {
  return `<!doctype html>
<html>
  <head><title>Connection Failed</title></head>
  <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa">
    <div style="text-align:center">
      <div style="font-size:48px;margin-bottom:16px">&#10007;</div>
      <h1 style="margin:0 0 8px">Connection Failed</h1>
      <p style="color:#666">${message}</p>
      <p style="color:#999;font-size:14px">Close this tab and try again in your terminal.</p>
    </div>
  </body>
</html>`;
}

// ── Redirect Helpers ──

function buildRedirectForCompletion(
  stateData: Record<string, string>,
  providerName: SourceType,
  opts: { reactivated?: boolean; setupAction?: string }
): CallbackProcessResult {
  const redirectTo = stateData.redirectTo;

  if (redirectTo === "inline") {
    return { kind: "inline_html", html: successHtml(providerName) };
  }

  if (redirectTo) {
    const redirectUrl = new URL(redirectTo);
    if (opts.reactivated) {
      redirectUrl.searchParams.set("reactivated", "true");
    }
    if (opts.setupAction) {
      redirectUrl.searchParams.set("setup_action", opts.setupAction);
    }
    return { kind: "redirect", url: redirectUrl.toString() };
  }

  // Default: redirect to app (existing behavior, backwards compatible)
  const redirectUrl = new URL(`${appUrl}/provider/${providerName}/connected`);
  if (opts.reactivated) {
    redirectUrl.searchParams.set("reactivated", "true");
  }
  if (opts.setupAction) {
    redirectUrl.searchParams.set("setup_action", opts.setupAction);
  }
  return { kind: "redirect", url: redirectUrl.toString() };
}

function buildRedirectForError(
  stateData: Record<string, string>,
  providerName: SourceType,
  message: string
): CallbackProcessResult {
  const redirectTo = stateData.redirectTo;

  if (redirectTo === "inline") {
    return { kind: "inline_html", html: errorHtml(message), status: 400 };
  }

  if (redirectTo) {
    return {
      kind: "redirect",
      url: `${redirectTo}?error=${encodeURIComponent(message)}`,
    };
  }

  return {
    kind: "redirect",
    url: `${appUrl}/provider/${providerName}/connected?error=${encodeURIComponent(message)}`,
  };
}

// ── Main Callback Processing ──

export interface ProcessCallbackParams {
  provider: SourceType;
  /** All query params from the callback URL */
  query: Record<string, string>;
  /** The state token from the callback query string */
  state: string;
}

/**
 * Process an OAuth callback: validate state, exchange code, upsert installation,
 * persist tokens, and return a structured result for the Route Handler to act on.
 */
export async function processOAuthCallback(
  params: ProcessCallbackParams
): Promise<CallbackProcessResult> {
  const { provider: providerName, state, query } = params;

  const providerDef = getProvider(providerName);
  const config = providerConfigs[providerName];

  if (!config) {
    log.warn("[oauth/callback] provider not configured", {
      provider: providerName,
    });
    return {
      kind: "error",
      error: "unknown_provider",
      status: 400,
    };
  }

  let stateData = await consumeOAuthState(state);

  // GitHub-initiated redirects (permission changes, reinstalls) arrive without
  // our state token. If state is missing but installation_id is present, look up
  // the existing installation to recover orgId/connectedBy.
  if (!stateData && providerName === "github") {
    const installationId = query.installation_id;
    if (installationId) {
      const existing = await db
        .select({
          orgId: gatewayInstallations.orgId,
          connectedBy: gatewayInstallations.connectedBy,
        })
        .from(gatewayInstallations)
        .where(
          and(
            eq(gatewayInstallations.provider, "github"),
            eq(gatewayInstallations.externalId, installationId)
          )
        )
        .limit(1);

      const row = existing[0];
      if (row) {
        stateData = {
          provider: "github",
          orgId: row.orgId,
          connectedBy: row.connectedBy,
        };
      }
    }
  }

  if (!stateData) {
    log.warn("[oauth/callback] invalid or expired state", {
      provider: providerName,
      state: state ? `${state.slice(0, 8)}...` : "empty",
    });
    return {
      kind: "error",
      error: "invalid_or_expired_state",
      status: 400,
    };
  }

  if (stateData.provider !== providerName) {
    log.warn("[oauth/callback] state provider mismatch", {
      provider: providerName,
      stateProvider: stateData.provider,
    });
    return {
      kind: "error",
      error: "invalid_or_expired_state",
      status: 400,
    };
  }

  const orgId = stateData.orgId ?? "";
  const connectedBy = stateData.connectedBy ?? "unknown";

  try {
    const auth = providerDef.auth;
    if (auth.kind !== "oauth" && auth.kind !== "app-token") {
      log.warn("[oauth/callback] provider does not support OAuth callback", {
        provider: providerName,
        authKind: auth.kind,
      });
      return {
        kind: "error",
        error: "provider_does_not_support_oauth",
        status: 400,
      };
    }

    // Pure provider logic — no DB, no framework coupling.
    // Both OAuthDef and AppTokenDef have processCallback — TypeScript narrows here.
    // SAFETY: config is providerConfigs[providerName], created by the same provider's
    // createConfig(). Runtime type matches TConfig; the service cannot know TConfig
    // statically because it serves all providers from a single Record<string, unknown>.
    const result = await auth.processCallback(config as never, query);

    // Handle pending-setup: provider needs additional configuration (e.g., GitHub App request flow).
    // No installation to upsert — just store the setup action and redirect.
    if (result.status === "pending-setup") {
      await storeOAuthResult(state, {
        status: "completed",
        provider: providerName,
        setupAction: result.setupAction,
      });

      log.info("[oauth/callback] pending setup, redirecting", {
        provider: providerName,
        setupAction: result.setupAction,
      });
      return buildRedirectForCompletion(stateData, providerName, {
        setupAction: result.setupAction,
      });
    }

    // For all connected statuses: detect reactivation and upsert installation
    const existingRows = await db
      .select({ id: gatewayInstallations.id })
      .from(gatewayInstallations)
      .where(
        and(
          eq(gatewayInstallations.provider, providerName),
          eq(gatewayInstallations.externalId, result.externalId)
        )
      )
      .limit(1);

    const reactivated = existingRows.length > 0;

    // Parse through schema to validate and narrow to ProviderAccountInfo
    // (processCallback returns BaseProviderAccountInfo at the type level when
    // called through the union — schema parse gives us the concrete discriminated type)
    const accountInfo = providerAccountInfoSchema.parse(result.accountInfo);

    // Upsert installation — idempotent on (provider, externalId)
    const rows = await db
      .insert(gatewayInstallations)
      .values({
        provider: providerName,
        externalId: result.externalId,
        connectedBy,
        orgId,
        status: "active",
        providerAccountInfo: accountInfo,
      })
      .onConflictDoUpdate({
        target: [
          gatewayInstallations.provider,
          gatewayInstallations.externalId,
        ],
        set: {
          status: "active",
          connectedBy,
          orgId,
          providerAccountInfo: accountInfo,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning({ id: gatewayInstallations.id });

    const installation = rows[0];
    if (!installation) {
      throw new Error("upsert_failed");
    }

    // Persist OAuth tokens for statuses that include them
    if (result.status === "connected") {
      await writeTokenRecord(installation.id, result.tokens);
    }

    // Store completion result in Redis for CLI polling (5-min TTL)
    await storeOAuthResult(state, {
      status: "completed",
      provider: providerName,
      ...(reactivated ? { reactivated: "true" } : {}),
    });

    log.info("[oauth/callback] connected", {
      provider: providerName,
      reactivated,
    });
    return buildRedirectForCompletion(stateData, providerName, {
      reactivated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    log.error("[oauth/callback] oauth callback failed", {
      provider: providerName,
      error: message,
    });

    // Store error result for CLI polling
    await storeOAuthResult(state, {
      status: "failed",
      error: message,
    });

    return buildRedirectForError(stateData, providerName, message);
  }
}
