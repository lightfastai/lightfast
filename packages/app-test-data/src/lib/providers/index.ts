import type { ProviderSlug } from "@repo/app-providers";
import { github } from "./github";
import { linear } from "./linear";
import { sentry } from "./sentry";
import type { SandboxProvider } from "./types";
import { vercel } from "./vercel";

const PROVIDERS: Partial<Record<ProviderSlug, SandboxProvider>> = {
  github,
  linear,
  sentry,
  vercel,
};

export function getSandboxProvider(slug: ProviderSlug): SandboxProvider {
  const provider = PROVIDERS[slug];
  if (!provider) {
    throw new Error(`No sandbox provider registered for "${slug}"`);
  }
  return provider;
}

export function listSandboxProviders(): ReadonlyArray<
  readonly [ProviderSlug, SandboxProvider]
> {
  return Object.entries(PROVIDERS) as ReadonlyArray<
    readonly [ProviderSlug, SandboxProvider]
  >;
}
