import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { BillingSettingsClient } from "./_components/billing-settings-client";

export const dynamic = "force-dynamic";

export default function BillingPage() {
  prefetch(trpc.org.settings.orgBilling.overview.queryOptions());

  return (
    <HydrateClient>
      <BillingSettingsClient />
    </HydrateClient>
  );
}
