import { HydrateClient, orgTrpc, prefetch } from "@repo/console-trpc/server";
import { RealtimeProviderWrapper } from "@repo/console-upstash-realtime/client";

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
        limit: 30,
      })
    );
  }

  return (
    <HydrateClient>
      <RealtimeProviderWrapper>{children}</RealtimeProviderWrapper>
    </HydrateClient>
  );
}
