import type { IconDef } from "@repo/console-providers/display";
import type { SVGProps } from "react";

export function ProviderIcon({ icon, ...props }: SVGProps<SVGSVGElement> & { icon: IconDef }) {
	return (
		<svg role="img" viewBox={icon.viewBox} fill="currentColor" {...props}>
			<path d={icon.d} />
		</svg>
	);
}
