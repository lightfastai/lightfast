import type { ProviderApi, RateLimit } from "../../define";
import { decodeSentryToken } from "./auth";

// ── Rate Limit Parser ───────────────────────────────────────────────────────────

export function parseSentryRateLimit(headers: Headers): RateLimit | null {
  const remaining = headers.get("x-sentry-rate-limit-remaining");
  const limit = headers.get("x-sentry-rate-limit-limit");
  const reset = headers.get("x-sentry-rate-limit-reset");
  if (!remaining || !limit || !reset) return null;
  const r = parseInt(remaining, 10);
  const l = parseInt(limit, 10);
  const s = parseFloat(reset); // UTC epoch SECONDS
  if (Number.isNaN(r) || Number.isNaN(l) || Number.isNaN(s)) return null;
  return { remaining: r, limit: l, resetAt: new Date(s * 1000) };
}

// ── API Definition ──────────────────────────────────────────────────────────────

export const sentryApi: ProviderApi = {
  baseUrl: "https://sentry.io",
  buildAuthHeader: (token) => `Bearer ${decodeSentryToken(token).token}`,
  parseRateLimit: parseSentryRateLimit,
  endpoints: {},
} as const;
