import {
  ChevronDownIcon as ChevronDown,
  Loading03Icon as LoaderCircle,
  ReloadIcon as RefreshCw,
  SignalIcon,
  UserCircleIcon as UserRound,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { PeopleEmptyState } from "./people-empty-state";
import {
  formatPersonSignalRef,
  getPersonName,
  getPersonSignals,
  getPersonTypeLabel,
  type PersonRow,
} from "./people-model";
import { PersonProviderIcon } from "./people-provider-icon";

const ROW_GRID =
  "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_7rem_9rem] items-center gap-3";

export function PeopleTableView({
  fetchNextPage,
  hasActiveFilters,
  hasNextPage,
  isError,
  isFetching,
  isFetchingNextPage,
  isPlaceholderData,
  onSelectPerson,
  refetch,
  rows,
  selectedPersonId,
}: {
  fetchNextPage: () => void;
  hasActiveFilters: boolean;
  hasNextPage: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isPlaceholderData: boolean;
  onSelectPerson: (publicId: string) => void;
  refetch: () => void;
  rows: PersonRow[];
  selectedPersonId: string | null;
}) {
  if (isError && rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-muted-foreground text-sm">
          Could not load people for this workspace.
        </p>
        <Button
          aria-label="Retry loading people"
          onClick={refetch}
          size="sm"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="size-3.5"
            icon={RefreshCw}
          />
          Retry
        </Button>
      </div>
    );
  }

  if (rows.length === 0 && !hasActiveFilters) {
    return (
      <PeopleEmptyState
        description="People discovered by the signal pipeline will appear here."
        title="No people yet"
      />
    );
  }

  if (rows.length === 0 && hasActiveFilters) {
    return (
      <PeopleEmptyState
        description="Try a different provider or type filter."
        title="No matching people"
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        aria-busy={isPlaceholderData}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          isPlaceholderData && "opacity-60 transition-opacity"
        )}
      >
        <div
          className={cn(
            ROW_GRID,
            "h-9 border-border/70 border-b bg-muted/25 px-4 text-muted-foreground text-xs"
          )}
        >
          <span>Name</span>
          <span>Identity</span>
          <span>Type</span>
          <span>Signals</span>
        </div>

        {rows.map((person) => (
          <PeopleTableRow
            isSelected={selectedPersonId === person.publicId}
            key={person.publicId}
            onSelect={() => onSelectPerson(person.publicId)}
            person={person}
          />
        ))}

        {hasNextPage ? (
          <div className="px-3 py-3">
            <Button
              aria-label="Load more people"
              disabled={isFetchingNextPage}
              onClick={fetchNextPage}
              size="sm"
              type="button"
              variant="ghost"
            >
              {isFetchingNextPage ? (
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                  icon={LoaderCircle}
                />
              ) : (
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-3.5"
                  icon={ChevronDown}
                />
              )}
              {isFetchingNextPage ? "Loading" : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 border-border/70 border-t px-4 py-2.5 text-muted-foreground text-xs">
        <span>
          {rows.length} {rows.length === 1 ? "person" : "people"}
        </span>
        {isFetching && !isFetchingNextPage ? (
          <span className="flex items-center gap-1 text-muted-foreground/70">
            <HugeiconsIcon
              aria-hidden="true"
              className="size-3 animate-spin"
              icon={LoaderCircle}
            />
            Refreshing
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PeopleTableRow({
  isSelected,
  onSelect,
  person,
}: {
  isSelected: boolean;
  onSelect: () => void;
  person: PersonRow;
}) {
  const name = getPersonName(person);
  const { more, ref } = getPersonSignals(person);

  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        ROW_GRID,
        "min-h-12 w-full border-border/40 border-b px-4 text-left hover:bg-muted/30",
        isSelected ? "bg-muted/35" : "bg-background"
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <HugeiconsIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground/70"
          icon={UserRound}
        />
        <span
          className={cn(
            "min-w-0 truncate text-sm",
            person.displayName
              ? "font-medium text-foreground"
              : "text-muted-foreground"
          )}
        >
          {name}
        </span>
      </span>

      <span className="flex min-w-0 items-center gap-2.5">
        <PersonProviderIcon
          className="size-3.5 shrink-0 text-muted-foreground/70"
          provider={person.identityProvider}
        />
        <span className="min-w-0 truncate font-mono text-foreground text-sm">
          {person.identityValue}
        </span>
      </span>

      <span className="truncate text-muted-foreground text-sm">
        {getPersonTypeLabel(person.identityType)}
      </span>

      <span className="flex min-w-0 items-center gap-2">
        {ref ? (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border/70 bg-muted/25 px-2 font-mono text-muted-foreground text-xs">
            <HugeiconsIcon
              aria-hidden="true"
              className="size-3"
              icon={SignalIcon}
            />
            {formatPersonSignalRef(ref)}
          </span>
        ) : (
          <span className="text-muted-foreground/60 text-sm">-</span>
        )}
        {more > 0 ? (
          <span className="text-muted-foreground/60 text-xs">+{more}</span>
        ) : null}
      </span>
    </button>
  );
}
