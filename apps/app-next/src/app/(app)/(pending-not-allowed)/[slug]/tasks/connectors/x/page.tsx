import { pathForSetupRequirement } from "@repo/app-setup-contract";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getQueryClient, HydrateClient, trpc } from "~/trpc/server";
import { XConnectorSetupClient } from "./_components/x-connector-setup-client";

interface XConnectorSetupPageProps {
  params: Promise<{ slug: string }>;
}

export default async function XConnectorSetupPage({
  params,
}: XConnectorSetupPageProps) {
  const { slug } = await params;
  const queryClient = getQueryClient();
  const gate = await queryClient.fetchQuery(
    trpc.viewer.organization.getBySlug.queryOptions({ slug })
  );

  if (gate.bindingStatus === "bound") {
    redirect(`/${slug}/tasks/connectors/x/complete` as Route);
  }

  if (
    gate.nextSetupRequirement &&
    gate.nextSetupRequirement !== "x_connector"
  ) {
    redirect(
      pathForSetupRequirement({
        orgSlug: slug,
        requirement: gate.nextSetupRequirement,
      }) as Route
    );
  }

  await queryClient.fetchQuery(
    trpc.org.workspace.connectors.list.queryOptions()
  );

  return (
    <HydrateClient>
      <XConnectorSetupClient orgSlug={slug} />
    </HydrateClient>
  );
}
