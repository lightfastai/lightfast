import { XConnectorSetupCompleteClient } from "./_components/x-connector-setup-complete-client";

interface XConnectorSetupCompletePageProps {
  params: Promise<{ slug: string }>;
}

export default async function XConnectorSetupCompletePage({
  params,
}: XConnectorSetupCompletePageProps) {
  const { slug } = await params;

  return <XConnectorSetupCompleteClient orgSlug={slug} />;
}
