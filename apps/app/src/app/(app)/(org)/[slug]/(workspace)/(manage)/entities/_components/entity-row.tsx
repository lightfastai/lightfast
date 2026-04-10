"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { TableCell, TableRow } from "@repo/ui/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import type { Entity } from "~/types";

interface EntityRowProps {
  entity: Entity;
}

export function EntityRow({ entity }: EntityRowProps) {
  const router = useRouter();
  const params = useParams<{ slug: string }>();

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() =>
        router.push(`/${params.slug}/entities/${entity.externalId}` as Route)
      }
    >
      <TableCell className="py-3">
        <Badge className="font-normal text-xs" variant="outline">
          {entity.category}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[360px] py-3">
        <span className="block truncate font-medium text-sm">{entity.key}</span>
        {entity.value && (
          <span className="block truncate text-muted-foreground text-xs">
            {entity.value}
          </span>
        )}
      </TableCell>
      <TableCell className="py-3">
        {entity.state && (
          <Badge className="font-normal text-xs" variant="secondary">
            {entity.state}
          </Badge>
        )}
      </TableCell>
      <TableCell className="py-3 text-center text-muted-foreground text-sm tabular-nums">
        {entity.occurrenceCount}
      </TableCell>
      <TableCell className="py-3 text-right text-muted-foreground text-sm">
        {formatDistanceToNow(new Date(entity.lastSeenAt), {
          addSuffix: true,
        })}
      </TableCell>
    </TableRow>
  );
}
