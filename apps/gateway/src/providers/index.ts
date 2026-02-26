import { HTTPException } from "hono/http-exception";
import { GitHubProvider } from "./impl/github.js";
import { LinearProvider } from "./impl/linear.js";
import { SentryProvider } from "./impl/sentry.js";
import { VercelProvider } from "./impl/vercel.js";
import type {
  WebhookProvider,
  ProviderFor,
  ProviderName,
} from "./types.js";

export type {
  WebhookProvider,
  ProviderName,
  WebhookPayload,
  GitHubWebhookPayload,
  VercelWebhookPayload,
  LinearWebhookPayload,
  SentryWebhookPayload,
  WebhookPayloadFor,
  ProviderFor,
} from "./types.js";

const providers = new Map<ProviderName, WebhookProvider>([
  ["github", new GitHubProvider()],
  ["vercel", new VercelProvider()],
  ["linear", new LinearProvider()],
  ["sentry", new SentryProvider()],
]);

/** Type-safe provider lookup. Literal names return specific provider types. */
export function getProvider<N extends ProviderName>(name: N): ProviderFor<N>;
export function getProvider(name: string): WebhookProvider;
export function getProvider(name: string): WebhookProvider {
  const provider = providers.get(name as ProviderName);
  if (!provider) {
    throw new HTTPException(400, { message: `Unknown provider: ${name}` });
  }
  return provider;
}

export { GitHubProvider, VercelProvider, LinearProvider, SentryProvider };
