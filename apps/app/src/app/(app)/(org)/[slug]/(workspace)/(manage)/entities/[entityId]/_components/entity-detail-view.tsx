"use client";

import { useTRPC } from "@repo/app-trpc/react";
import type { EntityEventNotification } from "@repo/app-upstash-realtime";
import { useRealtime } from "@repo/app-upstash-realtime/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { EntityEvent } from "~/types";
import { EntityEventRow } from "./entity-event-row";

interface EntityDetailViewProps {
  entityId: string;
}

export function EntityDetailView({ entityId }: EntityDetailViewProps) {
  const trpc = useTRPC();
  const params = useParams<{ slug: string }>();

  const { data: entity } = useSuspenseQuery(
    trpc.entities.get.queryOptions({ externalId: entityId })
  );

  const {
    data: eventsData,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useSuspenseInfiniteQuery(
    trpc.entities.getEvents.infiniteQueryOptions(
      { externalId: entityId, limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      }
    )
  );

  const dbEvents = useMemo(
    () => eventsData.pages.flatMap((page) => page.events),
    [eventsData.pages]
  );

  // Live events — prepend new events for this entity in real time
  const [liveEvents, setLiveEvents] = useState<EntityEventNotification[]>([]);
  const isDefaultView = eventsData.pages.length <= 1;

  const { status } = useRealtime({
    channels: entity.clerkOrgId ? [`org-${entity.clerkOrgId}`] : [],
    events: ["org.entityEvent"],
    enabled: !!entity.clerkOrgId && isDefaultView,
    onData({ data: notification }) {
      if (notification.entityExternalId !== entityId) {
        return;
      }
      if (notification.clerkOrgId !== entity.clerkOrgId) {
        return;
      }
      setLiveEvents((prev) => [notification, ...prev]);
    },
  });

  // Stable set of DB event IDs for dedup
  const dbEventIds = useMemo(
    () => new Set(dbEvents.map((e) => e.id)),
    [dbEvents]
  );

  // Merge: live prepend + all pages
  const allEvents = useMemo(() => {
    const newLive = liveEvents.filter((e) => !dbEventIds.has(e.eventId));
    const liveAsEvents: EntityEvent[] = newLive.map((e) => ({
      id: e.eventId,
      externalId: e.eventExternalId,
      observationType: e.observationType,
      title: e.title,
      content: "",
      source: e.source,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      significanceScore: e.significanceScore,
      occurredAt: e.occurredAt,
      refLabel: e.refLabel,
    }));
    return [...liveAsEvents, ...dbEvents];
  }, [liveEvents, dbEventIds, dbEvents]);

  return (
    <div className="space-y-6 pb-6">
      {/* Back link */}
      <Link
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        href={`/${params.slug}/entities`}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Entities
      </Link>

      {/* Entity header */}
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{entity.category}</Badge>
          {entity.state && <Badge variant="secondary">{entity.state}</Badge>}
        </div>
        <h1 className="mt-2 font-semibold text-2xl tracking-tight">
          {entity.key}
        </h1>
        {entity.value && (
          <p className="mt-1 text-muted-foreground">{entity.value}</p>
        )}
        <div className="mt-3 flex items-center gap-4 text-muted-foreground text-sm">
          <span>
            Seen {entity.occurrenceCount}{" "}
            {entity.occurrenceCount === 1 ? "time" : "times"}
          </span>
          <span>
            Last active{" "}
            {formatDistanceToNow(new Date(entity.lastSeenAt), {
              addSuffix: true,
            })}
          </span>
          {entity.url && (
            <a
              className="inline-flex items-center gap-1 text-primary hover:underline"
              href={entity.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink className="h-3 w-3" />
              View source
            </a>
          )}
        </div>
      </div>

      {/* Events timeline */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-semibold text-lg">Events</h2>
          {status === "connected" && isDefaultView && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Live
            </div>
          )}
        </div>
        {allEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No events linked to this entity yet.
          </p>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-border/60">
              {allEvents.map((event) => (
                <EntityEventRow event={event} key={event.id} />
              ))}
            </div>
            {hasNextPage && (
              <div className="flex justify-center py-3">
                <Button
                  disabled={isFetchingNextPage}
                  onClick={() => void fetchNextPage()}
                  size="sm"
                  variant="outline"
                >
                  {isFetchingNextPage ? "Loading..." : "Load more events"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
