import { useDeferredValue, useMemo } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { PeopleDetailSheet } from "./people-detail-sheet";
import {
  flattenPeoplePages,
  type PeopleClassificationFilters,
  type PersonRow,
} from "./people-model";
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
import { usePeopleListQuery } from "./use-people-list-query";

export function PeopleClient({
  search,
  setSearchParams,
  slug,
}: {
  search: NormalizedPeopleSearch;
  setSearchParams: (updates: Partial<NormalizedPeopleSearch>) => void;
  slug: string;
}) {
  const deferredQuery = useDeferredValue(search.peopleQuery);
  const searchText = deferredQuery.trim();
  const filters = useMemo<PeopleClassificationFilters>(
    () => ({
      providers: parsePersonProviders(search.provider),
      types: parsePersonTypes(search.type),
    }),
    [search.provider, search.type]
  );
  const hasActiveFilters =
    searchText.length > 0 ||
    filters.providers.length > 0 ||
    filters.types.length > 0;

  const { query: peopleQuery } = usePeopleListQuery({
    filters,
    search: searchText,
  });
  const rows = flattenPeoplePages(peopleQuery.data);
  const peopleByPublicId = useMemo(() => {
    const map = new Map<string, PersonRow>();
    for (const person of rows) {
      map.set(person.publicId, person);
    }
    return map;
  }, [rows]);

  return (
    <WorkspaceSurface
      className="flex min-h-full flex-col bg-background"
      variant="flush"
    >
      <h1 className="sr-only">People</h1>
      <PeopleToolbar
        filters={filters}
        onClearFilterGroup={(group) => {
          if (group === "provider") {
            setSearchParams({ provider: "", view: null });
          } else {
            setSearchParams({ type: "", view: null });
          }
        }}
        onQueryChange={(value) => setSearchParams({ peopleQuery: value })}
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
        query={search.peopleQuery}
        viewsSlot={
          <PeopleViewSwitcher
            search={search}
            setSearchParams={setSearchParams}
          />
        }
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
