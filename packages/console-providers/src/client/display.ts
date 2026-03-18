import { z } from "zod";
import type { IconDef } from "../icon";

export type { IconDef } from "../icon";

// ── Provider Display Schema ────────────────────────────────────────────────────
// Zod schema is the source of truth; ProviderDisplayEntry type is inferred.
// Zero runtime imports from server modules — only zod and icon.ts (no server deps).

// ── Canonical Slug Source ─────────────────────────────────────────────────────
// Defined first so PROVIDER_DISPLAY can be constrained by Record<ProviderSlug, ...>.
// Adding a slug here without a PROVIDER_DISPLAY entry → compile error (missing key).
// Adding a PROVIDER_DISPLAY entry without a slug here → compile error (unknown key).

export const providerSlugSchema = z.enum([
  "apollo",
  "github",
  "vercel",
  "linear",
  "sentry",
]);

export type ProviderSlug = z.infer<typeof providerSlugSchema>;

// ── Provider Display Schema ────────────────────────────────────────────────────
// Zod schema is the source of truth; ProviderDisplayEntry type is inferred.
// Zero runtime imports from server modules — only zod and icon.ts (no server deps).

export const providerDisplayEntrySchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string(),
  // z.custom<IconDef>() avoids importing iconDefSchema (server-only).
  // Full runtime validation of icon shape stays in define.ts.
  icon: z.custom<IconDef>(),
  comingSoon: z.literal(true).optional(),
});

export type ProviderDisplayEntry = z.infer<typeof providerDisplayEntrySchema>;

export const PROVIDER_DISPLAY = {
  apollo: {
    name: "apollo",
    displayName: "Apollo",
    description: "Connect your Apollo GTM workspace",
    comingSoon: true,
    icon: {
      viewBox: "0 0 24 24",
      d: "M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm0 2.4c5.302 0 9.6 4.298 9.6 9.6s-4.298 9.6-9.6 9.6S2.4 17.302 2.4 12 6.698 2.4 12 2.4zm0 2.4a7.2 7.2 0 1 0 0 14.4A7.2 7.2 0 0 0 12 4.8zm0 2.4a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6z",
    },
  },
  github: {
    name: "github",
    displayName: "GitHub",
    description: "Connect your GitHub repositories",
    icon: {
      viewBox: "0 0 24 24",
      d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
    },
  },
  vercel: {
    name: "vercel",
    displayName: "Vercel",
    description: "Connect your Vercel projects",
    comingSoon: true,
    icon: {
      viewBox: "0 0 24 24",
      d: "M24 22.525H0l12-21.05 12 21.05z",
    },
  },
  linear: {
    name: "linear",
    displayName: "Linear",
    description: "Connect your Linear workspace",
    comingSoon: true,
    icon: {
      viewBox: "0 0 24 24",
      d: "M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z",
    },
  },
  sentry: {
    name: "sentry",
    displayName: "Sentry",
    description: "Connect your Sentry projects",
    comingSoon: true,
    icon: {
      viewBox: "0 0 24 24",
      d: "M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z",
    },
  },
} as const satisfies Record<ProviderSlug, ProviderDisplayEntry>;
