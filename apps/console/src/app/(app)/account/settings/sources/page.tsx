import { prefetch, trpc, HydrateClient } from "@repo/console-trpc/server";
import { SourcesSettingsContent } from "./sources-settings-content";

export default async function SourcesSettingsPage() {
	// Prefetch user's personal integrations
	prefetch(trpc.account.integrations.list.queryOptions());

	return (
		<HydrateClient>
			<SourcesSettingsContent />
		</HydrateClient>
	);
}
