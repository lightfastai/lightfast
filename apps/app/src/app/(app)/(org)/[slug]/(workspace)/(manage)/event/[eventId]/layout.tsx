import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";

export default async function EventDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  prefetch(trpc.events.get.queryOptions({ id: Number(eventId) }));

  return <HydrateClient>{children}</HydrateClient>;
}
