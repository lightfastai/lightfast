"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import type { Entity } from "~/types";

export function MailboxEntityRow({ entity }: { entity: Entity }) {
  const router = useRouter();
  const params = useParams<{ slug: string }>();

  return (
    <button
      className="flex w-full flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent"
      onClick={() =>
        router.push(`/${params.slug}/entity/${entity.externalId}` as Route)
      }
      type="button"
    >
      <div className="flex items-center gap-2">
        <Badge className="font-normal text-xs" variant="outline">
          {entity.category}
        </Badge>
        {entity.state && (
          <Badge className="font-normal text-xs" variant="secondary">
            {entity.state}
          </Badge>
        )}
      </div>
      <span className="truncate font-medium text-sm">{entity.key}</span>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className="tabular-nums">{entity.occurrenceCount}x</span>
        <span>
          {formatDistanceToNow(new Date(entity.lastSeenAt), {
            addSuffix: true,
          })}
        </span>
      </div>
    </button>
  );
}
