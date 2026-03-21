import type { IconDef } from "@repo/app-providers/client";
import type { SVGProps } from "react";

export function ProviderIcon({
  icon,
  ...props
}: SVGProps<SVGSVGElement> & { icon: IconDef }) {
  return (
    <svg fill="currentColor" role="img" viewBox={icon.viewBox} {...props}>
      <path d={icon.d} />
    </svg>
  );
}
