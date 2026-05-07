// Inlined from former @repo/app-providers/client. Owned by apps/www so the
// marketing integrations page is independent of the (now-deleted) provider
// package after the v2 barebones reset.

const providerSlugs = [
  "apollo",
  "github",
  "vercel",
  "linear",
  "sentry",
] as const;

export type ProviderSlug = (typeof providerSlugs)[number];

export interface ProviderDisplayEntry {
  comingSoon?: true;
  description: string;
  displayName: string;
  name: ProviderSlug;
}

export const PROVIDER_DISPLAY = {
  apollo: {
    name: "apollo",
    displayName: "Apollo",
    description: "Connect your Apollo GTM workspace",
    comingSoon: true,
  },
  github: {
    name: "github",
    displayName: "GitHub",
    description: "Connect your GitHub repositories",
  },
  vercel: {
    name: "vercel",
    displayName: "Vercel",
    description: "Connect your Vercel projects",
  },
  linear: {
    name: "linear",
    displayName: "Linear",
    description: "Connect your Linear workspace",
    comingSoon: true,
  },
  sentry: {
    name: "sentry",
    displayName: "Sentry",
    description: "Connect your Sentry projects",
    comingSoon: true,
  },
} as const satisfies Record<ProviderSlug, ProviderDisplayEntry>;
