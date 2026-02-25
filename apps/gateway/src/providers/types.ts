import type {
  GitHubWebhookPayload as GH,
  VercelWebhookPayload as VC,
  LinearWebhookPayload as LN,
  SentryWebhookPayload as SN,
  WebhookPayload,
} from "./schemas";
import type { GitHubProvider } from "./impl/github";
import type { VercelProvider } from "./impl/vercel";
import type { LinearProvider } from "./impl/linear";
import type { SentryProvider } from "./impl/sentry";
import type { ProviderName } from "@repo/gateway-types";

// Re-export schema types for consumer convenience
export type {
  GitHubWebhookPayload,
  VercelWebhookPayload,
  LinearWebhookPayload,
  SentryWebhookPayload,
  WebhookPayload,
} from "./schemas";

// Re-export from @repo/gateway-types
export {
  PROVIDER_NAMES,
} from "@repo/gateway-types";
export type {
  ProviderName,
  WebhookReceiptPayload,
} from "@repo/gateway-types";

// ── Gateway-Specific Type Maps ──

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

/** Slim webhook-only interface for gateway providers. */
export interface WebhookProvider {
  readonly name: ProviderName;
  verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string,
  ): Promise<boolean>;
  parsePayload(raw: unknown): WebhookPayload;
  extractDeliveryId(headers: Headers, payload: WebhookPayload): string;
  extractEventType(headers: Headers, payload: WebhookPayload): string;
  extractResourceId(payload: WebhookPayload): string | null;
}
