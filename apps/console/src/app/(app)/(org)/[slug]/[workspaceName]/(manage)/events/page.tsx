import type { ProviderSlug } from "@repo/console-providers/display";
import { PROVIDER_SLUGS } from "@repo/console-providers/display";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { EventsTable } from "./_components/events-table";

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, workspaceName } = await params;
  const search = await searchParams;

  const initialSource =
    typeof search.source === "string" &&
    (PROVIDER_SLUGS as readonly string[]).includes(search.source)
      ? (search.source as ProviderSlug)
      : undefined;

  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="font-semibold text-2xl tracking-tight">Events</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Real-time activity from your connected sources.
        </p>
      </div>

      <Suspense fallback={<EventsFeedSkeleton />}>
        <EventsTable
          initialSource={initialSource}
          orgSlug={slug}
          workspaceName={workspaceName}
        />
      </Suspense>
    </div>
  );
}

function EventsFeedSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-80" />
      <div className="overflow-hidden rounded-lg border border-border/60">
        {Array.from({ length: 8 }, (_, i) => (
          <div className="border-border/60 border-b px-4 py-3" key={i}>
            <div className="flex items-start gap-3">
              <Skeleton className="mt-0.5 h-5 w-5 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
