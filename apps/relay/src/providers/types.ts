import type { ProviderName } from "@repo/gateway-types";
import type { RelayEnv } from "../env.js";
import type { GitHubProvider } from "./impl/github.js";
import type { LinearProvider } from "./impl/linear.js";
import type { SentryProvider } from "./impl/sentry.js";
import type { VercelProvider } from "./impl/vercel.js";
import type {
  GitHubWebhookPayload as GH,
  LinearWebhookPayload as LN,
  SentryWebhookPayload as SN,
  VercelWebhookPayload as VC,
  WebhookPayload,
} from "./schemas.js";

export type {
  ProviderName,
  WebhookReceiptPayload,
} from "@repo/gateway-types";

// Re-export from @repo/gateway-types
export { PROVIDER_NAMES } from "@repo/gateway-types";
// Re-export schema types for consumer convenience
export type {
  GitHubWebhookPayload,
  LinearWebhookPayload,
  SentryWebhookPayload,
  VercelWebhookPayload,
  WebhookPayload,
} from "./schemas.js";

// ── Relay-Specific Type Maps ──

/** Type map: narrow webhook payload per provider name */
export type WebhookPayloadFor<N extends ProviderName> = N extends "github"
  ? GH
  : N extends "vercel"
    ? VC
    : N extends "linear"
      ? LN
      : N extends "sentry"
        ? SN
        : never;

/** Type map: narrow provider class per provider name */
export type ProviderFor<N extends ProviderName> = N extends "github"
  ? GitHubProvider
  : N extends "vercel"
    ? VercelProvider
    : N extends "linear"
      ? LinearProvider
      : N extends "sentry"
        ? SentryProvider
        : never;

// ── WebhookProvider Interface ──

/** Slim webhook-only interface for relay providers. */
export interface WebhookProvider {
  extractDeliveryId(headers: Headers, payload: WebhookPayload): string;
  extractEventType(headers: Headers, payload: WebhookPayload): string;
  extractResourceId(payload: WebhookPayload): string | null;
  getWebhookSecret(env: RelayEnv): string;
  readonly name: ProviderName;
  parsePayload(raw: unknown): WebhookPayload;
  verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string
  ): Promise<boolean>;
}
