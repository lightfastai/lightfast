import type { ProviderSlug } from "@repo/app-providers/client";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";

const PROVIDER_TO_ICON_KEY: Record<
  ProviderSlug,
  keyof typeof IntegrationLogoIcons
> = {
  apollo: "apollo",
  github: "github",
  vercel: "vercel",
  linear: "linear",
  sentry: "sentry",
};

export function getProviderIcon(providerId: ProviderSlug) {
  return IntegrationLogoIcons[PROVIDER_TO_ICON_KEY[providerId]];
}
