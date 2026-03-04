import { HydrateClient, prefetch, orgTrpc } from "@repo/console-trpc/server";
import { RealtimeProviderWrapper } from "~/lib/realtime-provider";

interface EventsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string; workspaceName: string }>;
}

const SOURCES = [undefined, "github", "vercel", "linear", "sentry"] as const;

export default async function EventsLayout({
  children,
  params,
}: EventsLayoutProps) {
  const { slug, workspaceName } = await params;

  for (const source of SOURCES) {
    prefetch(
      orgTrpc.workspace.events.list.queryOptions({
        clerkOrgSlug: slug,
        workspaceName,
        source,
      }),
    );
  }

  return (
    <HydrateClient>
      <RealtimeProviderWrapper>{children}</RealtimeProviderWrapper>
    </HydrateClient>
  );
}
