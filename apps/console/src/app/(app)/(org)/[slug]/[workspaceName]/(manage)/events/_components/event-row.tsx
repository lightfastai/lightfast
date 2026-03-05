"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@repo/ui/components/ui/collapsible";
import { TableRow, TableCell } from "@repo/ui/components/ui/table";
import { Badge } from "@repo/ui/components/ui/badge";
import { PROVIDER_CONFIG } from "~/lib/provider-config";
import { EVENT_REGISTRY } from "@repo/console-providers";
import type { PostTransformEvent } from "@repo/console-providers";
import { EventDetail } from "./event-detail";

interface EventRowProps {
  event: {
    id: number;
    source: string;
    sourceType: string;
    sourceEvent: PostTransformEvent;
    ingestionSource: string;
    receivedAt: string;
    createdAt: string;
  };
}

export function EventRow({ event }: EventRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  const config = (PROVIDER_CONFIG as Record<string, (typeof PROVIDER_CONFIG)[keyof typeof PROVIDER_CONFIG] | undefined>)[event.source];
  const Icon = config?.icon;
  const registryKey = `${event.source}:${event.sourceType}`;
  const eventLabel =
    (EVENT_REGISTRY as Record<string, { label: string } | undefined>)[registryKey]?.label ??
    event.sourceType;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
      <>
        <CollapsibleTrigger asChild>
          <TableRow
            className="cursor-pointer"
            data-state={isOpen ? "selected" : undefined}
          >
            <TableCell className="w-8 py-3">
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                  isOpen && "rotate-90",
                )}
              />
            </TableCell>
            <TableCell className="w-8 py-3">
              {Icon ? (
                <Icon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <div className="h-4 w-4 rounded bg-muted" />
              )}
            </TableCell>
            <TableCell className="max-w-[360px] py-3">
              <span className="text-sm font-medium truncate block">
                {event.sourceEvent.title}
              </span>
            </TableCell>
            <TableCell className="py-3">
              <Badge variant="secondary" className="text-xs font-normal">
                {eventLabel}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground py-3">
              {event.sourceEvent.actor?.name ?? "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground text-right py-3">
              {formatDistanceToNow(new Date(event.sourceEvent.occurredAt), {
                addSuffix: true,
              })}
            </TableCell>
          </TableRow>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <tr>
            <td colSpan={6} className="p-0">
              <EventDetail event={event} />
            </td>
          </tr>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
}
