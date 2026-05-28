"use client";

import type { AppRouterOutputs } from "@api/app";
import { Badge } from "@repo/ui/components/ui/badge";
import { Input } from "@repo/ui/components/ui/input";
import { useSuspenseQuery } from "@tanstack/react-query";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import { Search, UsersRound } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useDeferredValue } from "react";
import { useTRPC } from "~/trpc/react";

type PeopleList = AppRouterOutputs["org"]["workspace"]["people"]["list"];
type PersonRow = PeopleList["items"][number];

export function PeopleClient() {
  const trpc = useTRPC();
  const [query, setQuery] = useQueryState(
    "peopleQuery",
    parseAsString.withDefault("")
  );
  const deferredQuery = useDeferredValue(query);
  const search = deferredQuery.trim();
  const listQueryOptions = trpc.org.workspace.people.list.queryOptions({
    limit: 50,
    search: search || undefined,
  });
  const { data } = useSuspenseQuery({
    ...listQueryOptions,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-medium font-pp text-2xl text-foreground">
            People
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Durable identities discovered from classified signals.
          </p>
        </div>
        <div className="flex w-72 items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            aria-label="Search people"
            onChange={(event) => void setQuery(event.currentTarget.value)}
            placeholder="Search people"
            value={query}
          />
        </div>
      </div>

      {data.items.length === 0 && search ? (
        <PeopleEmptyState title="No people found">
          No people match your search.
        </PeopleEmptyState>
      ) : data.items.length === 0 ? (
        <PeopleEmptyState title="No people yet">
          People discovered by the signal pipeline will appear here.
        </PeopleEmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem_5rem_9rem] gap-4 border-border/60 border-b bg-muted/30 px-4 py-2 text-muted-foreground text-xs">
            <span>Identity</span>
            <span>Provider</span>
            <span>Type</span>
            <span>Seen</span>
            <span>Updated</span>
          </div>
          {data.items.map((person) => (
            <PeopleRow key={person.publicId} person={person} />
          ))}
        </div>
      )}
    </div>
  );
}

function PeopleEmptyState({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 py-16 text-center">
      <div className="mb-4 rounded-full bg-muted/20 p-3">
        <UsersRound className="size-6 text-muted-foreground" />
      </div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="mt-1 max-w-sm text-muted-foreground text-sm">{children}</p>
    </div>
  );
}

function PeopleRow({ person }: { person: PersonRow }) {
  const name = person.displayName ?? person.identityValue;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem_5rem_9rem] items-center gap-4 border-border/60 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate font-medium text-sm">{name}</p>
        <p className="truncate text-muted-foreground text-xs">
          {person.identityValue}
        </p>
        <p className="truncate text-muted-foreground/80 text-xs">
          {person.normalizedIdentityValue}
        </p>
        <p className="truncate text-muted-foreground/70 text-xs">
          First: {person.firstSeenSignalId ?? "unknown"}
        </p>
        <p className="truncate text-muted-foreground/70 text-xs">
          Last: {person.lastSeenSignalId ?? "unknown"}
        </p>
      </div>
      <Badge className="w-fit rounded-full" variant="secondary">
        {person.identityProvider}
      </Badge>
      <span className="text-muted-foreground text-sm">
        {person.identityType}
      </span>
      <span className="text-sm">{person.seenCount}</span>
      <span className="text-muted-foreground text-xs">
        {formatRelativeTimeToNow(new Date(person.updatedAt), {
          addSuffix: true,
        })}
      </span>
    </div>
  );
}
