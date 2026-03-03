import type { ComponentType, SVGProps } from "react";
import type { SourceType } from "@repo/console-validation";
import { PROVIDER_REGISTRY } from "@repo/console-types";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import type { Source } from "~/types";

interface ProviderMeta {
	name: string;
	icon: ComponentType<SVGProps<SVGSVGElement>>;
	description: string;
}

/** Icon mapping — the only provider metadata that can't live in the shared package (React dependency) */
const PROVIDER_ICONS: Record<SourceType, ComponentType<SVGProps<SVGSVGElement>>> = {
	github: IntegrationLogoIcons.github,
	vercel: IntegrationLogoIcons.vercel,
	linear: IntegrationLogoIcons.linear,
	sentry: IntegrationLogoIcons.sentry,
};

/**
 * Provider display metadata for the console app.
 * Derives name/description from PROVIDER_REGISTRY, adds icon from React components.
 */
export const PROVIDER_CONFIG: Record<SourceType, ProviderMeta> = Object.fromEntries(
	(Object.keys(PROVIDER_REGISTRY) as SourceType[]).map((key) => [
		key,
		{
			name: PROVIDER_REGISTRY[key].name,
			icon: PROVIDER_ICONS[key],
			description: PROVIDER_REGISTRY[key].description,
		},
	]),
) as Record<SourceType, ProviderMeta>;

/** Ordered list of implemented provider keys. */
export const PROVIDER_ORDER = [
	"github",
	"vercel",
	"linear",
	"sentry",
] as const satisfies readonly SourceType[];

/** Value/label pairs for search filter dropdowns. */
export const SOURCE_TYPE_OPTIONS = PROVIDER_ORDER.map((key) => ({
	value: key,
	label: PROVIDER_CONFIG[key].name,
}));

/** Extract the primary display label from typed source metadata. */
export function getResourceLabel(metadata: Source["metadata"]): string {
	switch (metadata.sourceType) {
		case "github": return metadata.repoFullName;
		case "vercel": return metadata.projectName;
		case "linear": return metadata.teamName;
		case "sentry": return metadata.projectSlug;
	}
}
