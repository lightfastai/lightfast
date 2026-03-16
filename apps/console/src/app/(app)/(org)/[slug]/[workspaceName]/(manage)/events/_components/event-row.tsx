"use client";

import type { PostTransformEvent } from "@repo/console-providers";
import { EVENT_REGISTRY } from "@repo/console-providers";
import { PROVIDER_DISPLAY } from "@repo/console-providers/display";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { TableCell, TableRow } from "@repo/ui/components/ui/table";
import { cn } from "@repo/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { ProviderIcon } from "~/lib/provider-icon";
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

  const display = (
    PROVIDER_DISPLAY as Record<
      string,
      (typeof PROVIDER_DISPLAY)[keyof typeof PROVIDER_DISPLAY] | undefined
    >
  )[event.source];
  const registryKey = `${event.source}:${event.sourceType}`;
  const eventLabel =
    (EVENT_REGISTRY as Record<string, { label: string } | undefined>)[
      registryKey
    ]?.label ?? event.sourceType;

  return (
    <Collapsible asChild onOpenChange={setIsOpen} open={isOpen}>
      <CollapsibleTrigger asChild>
        <TableRow
          className="cursor-pointer"
          data-state={isOpen ? "selected" : undefined}
        >
          <TableCell className="w-8 py-3">
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                isOpen && "rotate-90"
              )}
            />
          </TableCell>
          <TableCell className="w-8 py-3">
            {display ? (
              <ProviderIcon
                className="h-4 w-4 text-muted-foreground"
                icon={display.icon}
              />
            ) : (
              <div className="h-4 w-4 rounded bg-muted" />
            )}
          </TableCell>
          <TableCell className="max-w-[360px] py-3">
            <span className="block truncate font-medium text-sm">
              {event.sourceEvent.title}
            </span>
          </TableCell>
          <TableCell className="py-3">
            <Badge className="font-normal text-xs" variant="secondary">
              {eventLabel}
            </Badge>
          </TableCell>
          <TableCell className="py-3 text-right text-muted-foreground text-sm">
            {formatDistanceToNow(new Date(event.sourceEvent.occurredAt), {
              addSuffix: true,
            })}
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <tr>
          <td className="p-0" colSpan={5}>
            <EventDetail event={event} />
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}
