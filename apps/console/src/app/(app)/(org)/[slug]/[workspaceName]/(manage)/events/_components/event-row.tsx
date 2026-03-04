"use client";

import { formatDistanceToNow } from "date-fns";
import { PROVIDER_CONFIG } from "~/lib/provider-config";
import { EVENT_REGISTRY } from "@repo/console-types";
import type { PostTransformEvent } from "@repo/console-validation";

interface EventRowProps {
  event: {
    id: number;
    source: string;
    sourceType: string;
    sourceEvent: PostTransformEvent;
    createdAt: string;
  };
}

export function EventRow({ event }: EventRowProps) {
  const config = (PROVIDER_CONFIG as Record<string, (typeof PROVIDER_CONFIG)[keyof typeof PROVIDER_CONFIG] | undefined>)[event.source];
  const Icon = config?.icon;
  const registryKey = `${event.source}:${event.sourceType}`;
  const eventLabel =
    (EVENT_REGISTRY as Record<string, { label: string } | undefined>)[registryKey]?.label ??
    event.sourceType;

  return (
    <div className="border-b border-border/60 py-3 px-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        {/* Provider icon */}
        <div className="mt-0.5 flex-shrink-0">
          {Icon ? (
            <Icon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <div className="h-4 w-4 rounded bg-muted" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {event.sourceEvent.title}
            </span>
            <span className="flex-shrink-0 text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              {eventLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {event.sourceEvent.actor && (
              <>
                <span className="text-xs text-muted-foreground">
                  {event.sourceEvent.actor.name}
                </span>
                <span className="text-xs text-muted-foreground/50">·</span>
              </>
            )}
            <span className="text-xs text-muted-foreground">
              {config?.name ?? event.source}
            </span>
            <span className="text-xs text-muted-foreground/50">·</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(
                new Date(event.sourceEvent.occurredAt),
                { addSuffix: true },
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
