import { prefetch, trpc, HydrateClient } from "@repo/console-trpc/server";
import { GeneralSettingsContent } from "./general-settings-content";

export default async function GeneralSettingsPage() {
	// Prefetch user profile data
	prefetch(trpc.account.profile.get.queryOptions());

	return (
		<HydrateClient>
			<GeneralSettingsContent />
		</HydrateClient>
	);
}
