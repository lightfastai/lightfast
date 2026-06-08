import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import type { ComponentType } from "react";
import type { DecisionProvider } from "./decisions-model";

const PROVIDER_ICONS: Record<
  DecisionProvider,
  ComponentType<{ className?: string }>
> = {
  linear: IntegrationLogoIcons.linear,
  x: IntegrationLogoIcons.x,
};

export function DecisionProviderIcon({
  className,
  provider,
}: {
  className?: string;
  provider: DecisionProvider;
}) {
  const Icon = PROVIDER_ICONS[provider];
  if (!Icon) {
    return null;
  }
  return <Icon aria-hidden="true" className={className} />;
}
