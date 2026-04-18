"use client";

import { EVENT_LABELS, PROVIDER_DISPLAY } from "@repo/app-providers/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { ProviderIcon } from "~/lib/provider-icon";
import type { EventListItem } from "~/types";

export function MailboxEventRow({ event }: { event: EventListItem }) {
  const router = useRouter();
  const params = useParams<{ slug: string }>();

  const display = (
    PROVIDER_DISPLAY as Record<
      string,
      (typeof PROVIDER_DISPLAY)[keyof typeof PROVIDER_DISPLAY] | undefined
    >
  )[event.source];
  const registryKey = `${event.source}:${event.sourceType}`;
  const eventLabel =
    (EVENT_LABELS as Record<string, string | undefined>)[registryKey] ??
    event.sourceType;

  return (
    <button
      className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent"
      onClick={() => router.push(`/${params.slug}/event/${event.id}` as Route)}
      type="button"
    >
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        {display ? (
          <ProviderIcon
            className="h-4 w-4 text-muted-foreground"
            icon={display.icon}
          />
        ) : (
          <div className="h-4 w-4 rounded bg-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium text-sm">
          {event.sourceEvent.title}
        </span>
        <div className="mt-0.5 flex items-center gap-2">
          <Badge className="font-normal text-xs" variant="secondary">
            {eventLabel}
          </Badge>
          <span className="text-muted-foreground text-xs">
            {formatDistanceToNow(new Date(event.sourceEvent.occurredAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>
    </button>
  );
}
