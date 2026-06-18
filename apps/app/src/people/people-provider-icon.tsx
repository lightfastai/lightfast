import {
  AtSignIcon as AtSign,
  BriefcaseIcon as Briefcase,
  CodeIcon as Code,
  GlobalIcon as Globe,
  Mail01Icon as Mail,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { PersonProvider } from "./people-model";

const PROVIDER_ICONS: Record<PersonProvider, IconSvgElement> = {
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
  const icon = PROVIDER_ICONS[provider] ?? Globe;
  return <HugeiconsIcon aria-hidden="true" className={className} icon={icon} />;
}
