"use client";

import { useState, useMemo } from "react";
import { useTRPC } from "@repo/console-trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useOrganization } from "@clerk/nextjs";
import { useRealtime } from "~/lib/realtime-client";
import { parseAsString, useQueryState } from "nuqs";
import type { EventNotification } from "~/lib/realtime";
import { EventRow } from "./event-row";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Radio } from "lucide-react";

const SOURCE_TABS = [
  { value: "all", label: "All" },
  { value: "github", label: "GitHub" },
  { value: "vercel", label: "Vercel" },
  { value: "linear", label: "Linear" },
  { value: "sentry", label: "Sentry" },
] as const;

interface EventsFeedProps {
  orgSlug: string;
  workspaceName: string;
  initialSource?: "github" | "vercel" | "linear" | "sentry";
}

export function EventsFeed({
  orgSlug,
  workspaceName,
  initialSource,
}: EventsFeedProps) {
  const [sourceParam, setSourceParam] = useQueryState(
    "source",
    parseAsString.withDefault(initialSource ?? "all").withOptions({ shallow: true }),
  );
  const source = sourceParam === "all" ? undefined : (sourceParam as "github" | "vercel" | "linear" | "sentry");

  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.workspace.events.list.queryOptions({
      clerkOrgSlug: orgSlug,
      workspaceName,
      source,
    }),
  );

  const { organization } = useOrganization();
  const [liveEvents, setLiveEvents] = useState<EventNotification[]>([]);

  const { status } = useRealtime({
    channels: organization?.id ? [`org-${organization.id}`] : [],
    events: ["workspace.event"],
    enabled: !!organization?.id,
    onData({ data: notification }) {
      // Only show events for this workspace
      if (notification.workspaceId !== data.workspaceId) return;
      // Apply source filter if active
      if (source && notification.sourceEvent.source !== source) return;
      setLiveEvents((prev) => [notification, ...prev]);
    },
  });

  // Merge live events with initial data, dedup by eventId
  const allEvents = useMemo(() => {
    const dbEventIds = new Set(data.events.map((e) => e.id));
    const newLive = liveEvents.filter((e) => !dbEventIds.has(e.eventId));

    return [
      ...newLive.map((e) => ({
        id: e.eventId,
        source: e.sourceEvent.source,
        sourceType: e.sourceEvent.sourceType,
        sourceEvent: e.sourceEvent,
        createdAt: new Date().toISOString(),
      })),
      ...data.events,
    ];
  }, [liveEvents, data.events]);

  // Clear live events when filter changes
  const handleSourceChange = (value: string) => {
    setLiveEvents([]);
    void setSourceParam(value);
  };

  return (
    <div className="space-y-4">
      {/* Source filter tabs */}
      <div className="flex items-center justify-between gap-4">
        <Tabs value={sourceParam} onValueChange={handleSourceChange}>
          <TabsList>
            {SOURCE_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Connection status indicator */}
        {status === "connected" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </div>
        )}
      </div>

      {/* Events list */}
      {allEvents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          {allEvents.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted/20 p-3 mb-4">
        <Radio className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold">No events yet</p>
      <p className="text-sm text-muted-foreground max-w-sm mt-1">
        Events will appear here as webhooks are received from your connected
        sources.
      </p>
    </div>
  );
}
