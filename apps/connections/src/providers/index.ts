import { HTTPException } from "hono/http-exception";
import { GitHubProvider } from "./impl/github.js";
import { LinearProvider } from "./impl/linear.js";
import { SentryProvider } from "./impl/sentry.js";
import { VercelProvider } from "./impl/vercel.js";
import type {
  ConnectionProvider,
  ProviderFor,
  ProviderName,
} from "./types.js";

export type {
  ConnectionProvider,
  ProviderName,
  OAuthTokens,
  ProviderOptions,
  AuthOptionsFor,
  GitHubAuthOptions,
  LinearAuthOptions,
  ProviderFor,
  TokenResult,
  JwtTokenResult,
  CallbackResult,
} from "./types.js";

const providers = new Map<ProviderName, ConnectionProvider>([
  ["github", new GitHubProvider()],
  ["vercel", new VercelProvider()],
]);

// Read from process.env directly for provider registration guards.
// The module-level `env` (from @t3-oss/env-core) only includes keys in
// `runtimeEnv` when `skipValidation=true`, which omits extended preset vars.
// Provider classes still use the validated `env` for their actual operations.
if (process.env.LINEAR_CLIENT_ID && process.env.LINEAR_CLIENT_SECRET) {
  providers.set("linear", new LinearProvider());
}

if (process.env.SENTRY_APP_SLUG && process.env.SENTRY_CLIENT_ID && process.env.SENTRY_CLIENT_SECRET) {
  providers.set("sentry", new SentryProvider());
}

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
