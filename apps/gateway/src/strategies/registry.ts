import type { ProviderName } from "../providers/types";
import type { ConnectionStrategy } from "./types";
import { GitHubStrategy } from "./github";
import { VercelStrategy } from "./vercel";
import { LinearStrategy } from "./linear";
import { SentryStrategy } from "./sentry";

const strategies = new Map<ProviderName, ConnectionStrategy>([
  ["github", new GitHubStrategy()],
  ["vercel", new VercelStrategy()],
  ["linear", new LinearStrategy()],
  ["sentry", new SentryStrategy()],
]);

export function getStrategy(provider: ProviderName): ConnectionStrategy {
  const strategy = strategies.get(provider);
  if (!strategy) {
    throw new Error(`No strategy registered for provider: ${provider}`);
  }
  return strategy;
}
