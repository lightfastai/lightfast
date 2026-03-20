import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { RealtimeProviderWrapper } from "@repo/app-upstash-realtime/client";

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
      trpc.workspace.events.list.queryOptions({
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
