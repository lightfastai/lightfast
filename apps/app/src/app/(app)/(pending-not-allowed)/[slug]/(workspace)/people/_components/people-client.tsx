"use client";

import { useParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { useDeferredValue, useMemo } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { PeopleDetailSheet } from "./people-detail-sheet";
import {
  flattenPeoplePages,
  type PeopleClassificationFilters,
  type PersonRow,
} from "./people-model";
import {
  parsePersonProviders,
  parsePersonTypes,
  personParser,
  personProviderParser,
  personQueryParser,
  personTypeParser,
  serializePersonValues,
  togglePersonValue,
} from "./people-search-params";
import { PeopleTableView } from "./people-table-view";
import { PeopleToolbar } from "./people-toolbar";
import { usePeopleListQuery } from "./use-people-list-query";

export function PeopleClient() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [query, setQuery] = useQueryState("peopleQuery", personQueryParser);
  const deferredQuery = useDeferredValue(query);
  const search = deferredQuery.trim();
  const [providerState, setProviderState] = useQueryState(
    "provider",
    personProviderParser
  );
  const [typeState, setTypeState] = useQueryState("type", personTypeParser);
  const [selectedPersonId, setSelectedPersonId] = useQueryState(
    "person",
    personParser
  );

  const filters = useMemo<PeopleClassificationFilters>(
    () => ({
      providers: parsePersonProviders(providerState),
      types: parsePersonTypes(typeState),
    }),
    [providerState, typeState]
  );
  const hasActiveFilters =
    search.length > 0 ||
    filters.providers.length > 0 ||
    filters.types.length > 0;

  const { query: peopleQuery } = usePeopleListQuery({ filters, search });
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
            void setProviderState("");
          } else {
            void setTypeState("");
          }
        }}
        onQueryChange={(value) => void setQuery(value)}
        onToggleProvider={(value) =>
          void setProviderState(
            serializePersonValues(togglePersonValue(filters.providers, value))
          )
        }
        onToggleType={(value) =>
          void setTypeState(
            serializePersonValues(togglePersonValue(filters.types, value))
          )
        }
        query={query}
      />

      <PeopleTableView
        fetchNextPage={() => void peopleQuery.fetchNextPage()}
        hasActiveFilters={hasActiveFilters}
        hasNextPage={!!peopleQuery.hasNextPage}
        isError={peopleQuery.isError}
        isFetching={peopleQuery.isFetching}
        isFetchingNextPage={peopleQuery.isFetchingNextPage}
        isPlaceholderData={peopleQuery.isPlaceholderData}
        onSelectPerson={(publicId) => void setSelectedPersonId(publicId)}
        refetch={() => void peopleQuery.refetch()}
        rows={rows}
        selectedPersonId={selectedPersonId}
      />

      <PeopleDetailSheet
        initialPerson={
          selectedPersonId ? peopleByPublicId.get(selectedPersonId) : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            void setSelectedPersonId(null);
          }
        }}
        publicId={selectedPersonId}
        slug={slug}
      />
    </WorkspaceSurface>
  );
}
