import { HTTPException } from "hono/http-exception";
import { GitHubProvider } from "./github";
import { LinearProvider } from "./linear";
import { SentryProvider } from "./sentry";
import { VercelProvider } from "./vercel";
import type {
  ConnectionProvider,
  ProviderFor,
  ProviderName,
} from "./types";

export type {
  ConnectionProvider,
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
} from "./types";

const providers = new Map<ProviderName, ConnectionProvider>([
  ["github", new GitHubProvider()],
  ["vercel", new VercelProvider()],
  ["linear", new LinearProvider()],
  ["sentry", new SentryProvider()],
]);

/** Type-safe provider lookup. Literal names return specific provider types. */
export function getProvider<N extends ProviderName>(name: N): ProviderFor<N>;
export function getProvider(name: string): ConnectionProvider;
export function getProvider(name: string): ConnectionProvider {
  const provider = providers.get(name as ProviderName);
  if (!provider) {
    throw new HTTPException(400, { message: `Unknown provider: ${name}` });
  }
  return provider;
}

export { GitHubProvider, VercelProvider, LinearProvider, SentryProvider };
