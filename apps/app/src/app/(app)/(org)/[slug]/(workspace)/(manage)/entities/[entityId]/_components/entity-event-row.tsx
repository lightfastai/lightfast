"use client";

import { PROVIDER_DISPLAY } from "@repo/app-providers/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ProviderIcon } from "~/lib/provider-icon";
import type { EntityEvent } from "~/types";

interface EntityEventRowProps {
  event: EntityEvent;
}

export function EntityEventRow({ event }: EntityEventRowProps) {
  const display = (
    PROVIDER_DISPLAY as Record<
      string,
      (typeof PROVIDER_DISPLAY)[keyof typeof PROVIDER_DISPLAY] | undefined
    >
  )[event.source];

  return (
    <div className="flex items-start gap-3 border-border/60 border-b px-4 py-3 last:border-b-0">
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
        <p className="truncate font-medium text-sm">{event.title}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge className="font-normal text-xs" variant="secondary">
            {event.observationType}
          </Badge>
          {event.refLabel && (
            <span className="text-muted-foreground text-xs">
              {event.refLabel}
            </span>
          )}
          {event.significanceScore != null && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {event.significanceScore}%
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 text-muted-foreground text-sm">
        {formatDistanceToNow(new Date(event.occurredAt), {
          addSuffix: true,
        })}
      </span>
    </div>
  );
}
