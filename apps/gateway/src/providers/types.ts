import type { SourceType } from "@repo/console-validation";
import type {
  GitHubWebhookPayload as GH,
  VercelWebhookPayload as VC,
  LinearWebhookPayload as LN,
  SentryWebhookPayload as SN,
  WebhookPayload,
} from "./schemas";
import type { GitHubProvider } from "./github";
import type { VercelProvider } from "./vercel";
import type { LinearProvider } from "./linear";
import type { SentryProvider } from "./sentry";
import type {
  ProviderName,
  ConnectionProvider,
  GitHubAuthOptions,
  LinearAuthOptions,
} from "@repo/gateway-types";

// Re-export for backward compatibility (lib/keys.ts, workflows/types.ts)
export type { SourceType };

// Re-export schema types for consumer convenience
export type {
  GitHubWebhookPayload,
  VercelWebhookPayload,
  LinearWebhookPayload,
  SentryWebhookPayload,
  WebhookPayload,
  SentryInstallationToken,
} from "./schemas";

// Re-export everything from @repo/gateway-types
export {
  PROVIDER_NAMES,
  INSTALLATION_STATUSES,
  RESOURCE_STATUSES,
  DELIVERY_STATUSES,
} from "@repo/gateway-types";
export type {
  ProviderName,
  InstallationStatus,
  ResourceStatus,
  DeliveryStatus,
  OAuthTokens,
  ConnectionProvider,
  WebhookRegistrant,
  GitHubAuthOptions,
  LinearAuthOptions,
  ProviderOptions,
  WebhookReceiptPayload,
} from "@repo/gateway-types";

// ── Gateway-Specific Type Maps ──

/** Narrow ConnectionProvider with the gateway's concrete WebhookPayload union */
export type GatewayConnectionProvider = ConnectionProvider<WebhookPayload>;

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

/** Type map: narrow auth options per provider name */
export type AuthOptionsFor<N extends ProviderName> = N extends "github"
  ? GitHubAuthOptions
  : N extends "linear"
    ? LinearAuthOptions
    : Record<string, never>;
