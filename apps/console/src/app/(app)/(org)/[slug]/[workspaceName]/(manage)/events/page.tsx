import { Suspense } from "react";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
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

  const validSources = ["github", "vercel", "linear", "sentry"];
  const initialSource =
    typeof search.source === "string" && validSources.includes(search.source)
      ? (search.source as "github" | "vercel" | "linear" | "sentry")
      : undefined;

  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time activity from your connected sources.
        </p>
      </div>

      <Suspense fallback={<EventsFeedSkeleton />}>
        <EventsTable
          orgSlug={slug}
          workspaceName={workspaceName}
          initialSource={initialSource}
        />
      </Suspense>
    </div>
  );
}

function EventsFeedSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-80" />
      <div className="rounded-lg border border-border/60 overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="border-b border-border/60 py-3 px-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 mt-0.5 rounded" />
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
