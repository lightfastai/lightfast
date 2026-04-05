/**
 * Build OAuth authorize URL for a provider.
 *
 * Ported from apps/gateway/src/routes/connections.ts (lines 79-141).
 * Returns a data structure — no HTTP responses.
 */
import type { SourceType } from "@repo/app-providers";
import { getProvider } from "@repo/app-providers";
import { nanoid } from "@repo/lib";
import { log } from "@vendor/observability/log/next";
import { providerConfigs } from "../provider-configs";
import { storeOAuthState } from "./state";

// ── App URL ──

/**
 * App URL for redirects.
 * Used to validate redirect_to parameters.
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

// ── Types ──

interface AuthorizeParams {
  connectedBy: string;
  orgId: string;
  provider: SourceType;
  redirectTo?: string;
}

type AuthorizeResult =
  | { ok: true; url: string; state: string }
  | { ok: false; error: string };

// ── Build Authorize URL ──

/**
 * Build an OAuth authorize URL for the given provider.
 *
 * Generates a cryptographically random state token, stores it in Redis,
 * and returns the authorization URL for the provider.
 *
 * @returns AuthorizeResult — either `{ ok: true, url, state }` or `{ ok: false, error }`.
 */
export async function buildAuthorizeUrl(
  params: AuthorizeParams
): Promise<AuthorizeResult> {
  const { provider, orgId, connectedBy, redirectTo } = params;

  const config = providerConfigs[provider];

  if (!config) {
    log.warn("[oauth/authorize] provider not configured", { provider });
    return { ok: false, error: "unknown_provider" };
  }

  // Validate redirect_to — allowlist: "inline", localhost, or appUrl
  if (redirectTo && redirectTo !== "inline") {
    try {
      const url = new URL(redirectTo);
      if (url.hostname !== "localhost" && !redirectTo.startsWith(appUrl)) {
        log.warn("[oauth/authorize] invalid redirect_to (not on allowlist)", {
          provider,
          redirectTo,
        });
        return { ok: false, error: "invalid_redirect_to" };
      }
    } catch {
      log.warn("[oauth/authorize] invalid redirect_to (malformed URL)", {
        provider,
        redirectTo,
      });
      return { ok: false, error: "invalid_redirect_to" };
    }
  }

  const state = nanoid();

  // Store OAuth state in Redis (10-minute TTL) — atomic pipeline
  await storeOAuthState(state, {
    provider,
    orgId,
    connectedBy,
    ...(redirectTo ? { redirectTo } : {}),
    createdAt: Date.now().toString(),
  });

  const providerDef = getProvider(provider);
  const auth = providerDef.auth;

  let url: string;
  if (auth.kind === "oauth") {
    // SAFETY: config is providerConfigs[providerName], created by the same provider's
    // createConfig(). Runtime type matches TConfig; the service cannot know TConfig
    // statically because it serves all providers from a single Record<string, unknown>.
    url = auth.buildAuthUrl(config as never, state);
  } else if (auth.kind === "app-token") {
    url = auth.buildInstallUrl(config as never, state);
  } else {
    log.warn("[oauth/authorize] provider does not support OAuth", { provider });
    return { ok: false, error: "provider_does_not_support_oauth" };
  }

  return { ok: true, url, state };
}
