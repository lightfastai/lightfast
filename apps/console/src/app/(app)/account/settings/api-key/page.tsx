import { prefetch, trpc, HydrateClient } from "@repo/console-trpc/server";
import { ApiKeySettingsContent } from "./api-key-settings-content";

export default async function ApiKeySettingsPage() {
	// Prefetch user's API keys
	prefetch(trpc.account.apiKeys.list.queryOptions());

	return (
		<HydrateClient>
			<ApiKeySettingsContent />
		</HydrateClient>
	);
}
