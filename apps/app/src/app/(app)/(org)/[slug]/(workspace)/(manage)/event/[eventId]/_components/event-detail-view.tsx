"use client";

import { EVENT_LABELS, PROVIDER_DISPLAY } from "@repo/app-providers/client";
import { useTRPC } from "@repo/app-trpc/react";
import { Badge } from "@repo/ui/components/ui/badge";
import { useSuspenseQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProviderIcon } from "~/lib/provider-icon";

export function EventDetailView({ eventId }: { eventId: number }) {
  const trpc = useTRPC();
  const params = useParams<{ slug: string }>();

  const { data: event } = useSuspenseQuery(
    trpc.events.get.queryOptions({ id: eventId })
  );

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

  const { sourceEvent } = event;

  return (
    <div className="space-y-6 pb-6">
      {/* Back link */}
      <Link
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        href={`/${params.slug}`}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Explore
      </Link>

      {/* Event header */}
      <div>
        <div className="flex items-center gap-2">
          {display && (
            <ProviderIcon
              className="h-5 w-5 text-muted-foreground"
              icon={display.icon}
            />
          )}
          <Badge className="font-normal text-xs" variant="secondary">
            {eventLabel}
          </Badge>
        </div>
        <h1 className="mt-2 font-semibold text-2xl tracking-tight">
          {sourceEvent.title}
        </h1>
        <div className="mt-3 flex items-center gap-4 text-muted-foreground text-sm">
          <span>
            {formatDistanceToNow(new Date(sourceEvent.occurredAt), {
              addSuffix: true,
            })}
          </span>
          <span>via {event.ingestionSource}</span>
        </div>
      </div>

      {/* Body */}
      {sourceEvent.body && (
        <div>
          <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Body
          </h2>
          <p className="whitespace-pre-wrap break-words text-foreground/80 text-sm leading-relaxed">
            {sourceEvent.body}
          </p>
        </div>
      )}

      {/* Entity */}
      <div>
        <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Entity
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          <dt className="text-muted-foreground text-xs">Type</dt>
          <dd className="font-mono text-xs">{sourceEvent.entity.entityType}</dd>
          <dt className="text-muted-foreground text-xs">ID</dt>
          <dd className="font-mono text-xs">{sourceEvent.entity.entityId}</dd>
          {sourceEvent.entity.state && (
            <>
              <dt className="text-muted-foreground text-xs">State</dt>
              <dd className="font-mono text-xs">{sourceEvent.entity.state}</dd>
            </>
          )}
        </dl>
      </div>

      {/* Relations */}
      {sourceEvent.relations.length > 0 && (
        <div>
          <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Relations
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {sourceEvent.relations.map((rel, i) => (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2 py-0.5 text-xs"
                key={i}
              >
                <span className="text-muted-foreground capitalize">
                  {rel.entityType}
                </span>
                {rel.url ? (
                  <a
                    className="font-mono text-primary hover:underline"
                    href={rel.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {rel.entityId}
                  </a>
                ) : (
                  <span className="font-mono">{rel.entityId}</span>
                )}
                <span className="text-muted-foreground/70">
                  {rel.relationshipType}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Attributes */}
      {Object.keys(sourceEvent.attributes).length > 0 && (
        <div>
          <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Attributes
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(sourceEvent.attributes).map(([key, value]) => (
              <div className="contents" key={key}>
                <dt className="truncate text-muted-foreground text-xs">
                  {key}
                </dt>
                <dd className="truncate font-mono text-xs">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-border/40 border-t pt-3">
        <div className="text-muted-foreground text-xs">Event time</div>
        <div className="font-mono text-xs">
          {formatDistanceToNow(new Date(sourceEvent.occurredAt), {
            addSuffix: true,
          })}
        </div>
        <div className="text-muted-foreground text-xs">Received</div>
        <div className="font-mono text-xs">
          {formatDistanceToNow(new Date(event.receivedAt), {
            addSuffix: true,
          })}
        </div>
        <div className="text-muted-foreground text-xs">Stored</div>
        <div className="font-mono text-xs">
          {formatDistanceToNow(new Date(event.createdAt), {
            addSuffix: true,
          })}
        </div>
        <div className="text-muted-foreground text-xs">Source ID</div>
        <div className="truncate font-mono text-xs">{sourceEvent.sourceId}</div>
        <div className="text-muted-foreground text-xs">Ingestion</div>
        <div className="font-mono text-xs">{event.ingestionSource}</div>
      </div>
    </div>
  );
}
