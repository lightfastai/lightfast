import { HTTPException } from "hono/http-exception";
import { GitHubProvider } from "./github";
import { LinearProvider } from "./linear";
import { SentryProvider } from "./sentry";
import { VercelProvider } from "./vercel";
import type { ConnectionProvider, SourceType } from "./types";

export type { ConnectionProvider, SourceType };

const providers = new Map<string, ConnectionProvider>([
  ["github", new GitHubProvider()],
  ["vercel", new VercelProvider()],
  ["linear", new LinearProvider()],
  ["sentry", new SentryProvider()],
]);

export function getProvider(name: string): ConnectionProvider {
  const provider = providers.get(name);
  if (!provider) {
    throw new HTTPException(400, { message: `Unknown provider: ${name}` });
  }
  return provider;
}

export { GitHubProvider, VercelProvider, LinearProvider, SentryProvider };
