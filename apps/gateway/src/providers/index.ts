import { HTTPException } from "hono/http-exception";
import { GitHubProvider } from "./github";
import { LinearProvider } from "./linear";
import { SentryProvider } from "./sentry";
import { VercelProvider } from "./vercel";
import type {
  UnifiedProvider,
  ProviderFor,
  ProviderName,
} from "./types";

export type {
  ConnectionProvider,
  UnifiedProvider,
  WebhookRegistrant,
  ProviderName,
  SourceType,
  OAuthTokens,
  ProviderOptions,
  WebhookPayload,
  GitHubWebhookPayload,
  VercelWebhookPayload,
  LinearWebhookPayload,
  SentryWebhookPayload,
  WebhookPayloadFor,
  AuthOptionsFor,
  GitHubAuthOptions,
  LinearAuthOptions,
  ProviderFor,
  TokenResult,
  JwtTokenResult,
  CallbackResult,
} from "./types";

const providers = new Map<ProviderName, UnifiedProvider>([
  ["github", new GitHubProvider()],
  ["vercel", new VercelProvider()],
  ["linear", new LinearProvider()],
  ["sentry", new SentryProvider()],
]);

/** Type-safe provider lookup. Literal names return specific provider types. */
export function getProvider<N extends ProviderName>(name: N): ProviderFor<N>;
export function getProvider(name: string): UnifiedProvider;
export function getProvider(name: string): UnifiedProvider {
  const provider = providers.get(name as ProviderName);
  if (!provider) {
    throw new HTTPException(400, { message: `Unknown provider: ${name}` });
  }
  return provider;
}

export { GitHubProvider, VercelProvider, LinearProvider, SentryProvider };
