import { McpConsentCard } from "./_components/mcp-consent-card";
import { getMcpConsentViewModel } from "./model";

export default async function McpAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const model = await getMcpConsentViewModel(await searchParams);
  return <McpConsentCard model={model} />;
}
