import { SidebarTrigger } from "@repo/ui-v2/components/ui/sidebar";
import { useInfiniteQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { PeopleDetailSheet } from "./people-detail-sheet";
import { PeopleLoading } from "./people-loading";
import {
  flattenPeoplePages,
  PEOPLE_PAGE_SIZE,
  type PeopleClassificationFilters,
  type PersonRow,
} from "./people-model";
import { peopleListInfiniteQueryOptions } from "./people-queries";
import {
  type NormalizedPeopleSearch,
  parsePersonProviders,
  parsePersonTypes,
  serializePersonValues,
  togglePersonValue,
} from "./people-search-params";
import { PeopleTableView } from "./people-table-view";
import { PeopleToolbar } from "./people-toolbar";
import { PeopleViewSwitcher } from "./people-view-switcher";

export function PeopleClient({
  search,
  setSearchParams,
  slug,
}: {
  search: NormalizedPeopleSearch;
  setSearchParams: (updates: Partial<NormalizedPeopleSearch>) => void;
  slug: string;
}) {
  const filters = useMemo<PeopleClassificationFilters>(
    () => ({
      providers: parsePersonProviders(search.provider),
      types: parsePersonTypes(search.type),
    }),
    [search.provider, search.type]
  );
  const hasActiveFilters =
    filters.providers.length > 0 || filters.types.length > 0;
  const listInput = {
    limit: PEOPLE_PAGE_SIZE,
    providers: filters.providers.length ? filters.providers : undefined,
    types: filters.types.length ? filters.types : undefined,
  };

  const peopleQuery = useInfiniteQuery(
    peopleListInfiniteQueryOptions(listInput)
  );
  const rows = flattenPeoplePages(peopleQuery.data);
  const peopleByPublicId = useMemo(() => {
    const map = new Map<string, PersonRow>();
    for (const person of rows) {
      map.set(person.publicId, person);
    }
    return map;
  }, [rows]);

  if (peopleQuery.isPending && rows.length === 0) {
    return (
      <WorkspaceSurface
        className="flex min-h-full flex-col bg-background"
        variant="flush"
      >
        <h1 className="sr-only">People</h1>
        <PeopleLoading />
      </WorkspaceSurface>
    );
  }

  return (
    <WorkspaceSurface
      className="flex min-h-full flex-col bg-background"
      variant="flush"
    >
      <h1 className="sr-only">People</h1>
      <PeopleViewHeader>
        <PeopleViewSwitcher search={search} setSearchParams={setSearchParams} />
      </PeopleViewHeader>
      <PeopleToolbar
        filters={filters}
        onClearFilterGroup={(group) => {
          if (group === "provider") {
            setSearchParams({ provider: "", view: null });
          } else {
            setSearchParams({ type: "", view: null });
          }
        }}
        onToggleProvider={(value) => {
          setSearchParams({
            provider: serializePersonValues(
              togglePersonValue(filters.providers, value)
            ),
            view: null,
          });
        }}
        onToggleType={(value) => {
          setSearchParams({
            type: serializePersonValues(
              togglePersonValue(filters.types, value)
            ),
            view: null,
          });
        }}
      />

      <PeopleTableView
        fetchNextPage={() => void peopleQuery.fetchNextPage()}
        hasActiveFilters={hasActiveFilters}
        hasNextPage={!!peopleQuery.hasNextPage}
        isError={peopleQuery.isError}
        isFetching={peopleQuery.isFetching}
        isFetchingNextPage={peopleQuery.isFetchingNextPage}
        isPlaceholderData={peopleQuery.isPlaceholderData}
        onSelectPerson={(publicId) => setSearchParams({ person: publicId })}
        refetch={() => void peopleQuery.refetch()}
        rows={rows}
        selectedPersonId={search.person}
      />

      <PeopleDetailSheet
        initialPerson={
          search.person ? peopleByPublicId.get(search.person) : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            setSearchParams({ person: null });
          }
        }}
        publicId={search.person}
        slug={slug}
      />
    </WorkspaceSurface>
  );
}

function PeopleViewHeader({ children }: { children: ReactNode }) {
  return (
    <header
      className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 py-3"
      data-testid="people-view-header"
    >
      <SidebarTrigger className="size-6 rounded-lg border border-border/70 bg-muted/30 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground md:hidden" />
      <div className="flex min-w-[12rem] flex-1 items-center overflow-hidden">
        {children}
      </div>
    </header>
  );
}
