import { AtSign, Briefcase, Code, Globe, Mail } from "lucide-react";
import type { ComponentType } from "react";
import type { PersonProvider } from "./people-model";

const PROVIDER_ICONS: Record<
  PersonProvider,
  ComponentType<{ className?: string }>
> = {
  email: Mail,
  github: Code,
  linkedin: Briefcase,
  website: Globe,
  x: AtSign,
};

export function PersonProviderIcon({
  className,
  provider,
}: {
  className?: string;
  provider: PersonProvider;
}) {
  const Icon = PROVIDER_ICONS[provider] ?? Globe;
  return <Icon aria-hidden="true" className={className} />;
}
