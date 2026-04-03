import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { RealtimeProviderWrapper } from "@repo/app-upstash-realtime/client";

const SOURCES = [undefined, "github", "vercel", "linear", "sentry"] as const;

export default async function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  for (const source of SOURCES) {
    prefetch(
      trpc.events.list.queryOptions({
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
