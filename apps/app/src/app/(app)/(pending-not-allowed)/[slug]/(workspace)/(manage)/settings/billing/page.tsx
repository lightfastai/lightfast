import { getQueryClient, HydrateClient, trpc } from "@repo/app-trpc/server";
import { BillingSettingsClient } from "./_components/billing-settings-client";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  await getQueryClient().fetchQuery(
    trpc.org.settings.orgBilling.overview.queryOptions()
  );

  return (
    <HydrateClient>
      <BillingSettingsClient />
    </HydrateClient>
  );
}
