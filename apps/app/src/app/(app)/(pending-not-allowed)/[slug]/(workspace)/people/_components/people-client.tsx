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
  parsePersonMemberStatuses,
  parsePersonProviders,
  parsePersonSources,
  parsePersonTypes,
  peopleSavedViewParser,
  personMemberStatusParser,
  personParser,
  personProviderParser,
  personQueryParser,
  personSourceParser,
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
  const [sourceState, setSourceState] = useQueryState(
    "source",
    personSourceParser
  );
  const [memberStatusState, setMemberStatusState] = useQueryState(
    "memberStatus",
    personMemberStatusParser
  );
  const [typeState, setTypeState] = useQueryState("type", personTypeParser);
  // Editing any filter in the toolbar drops the active saved view — you are now
  // on an ad-hoc selection. The switcher writes `view` + filter params together
  // (see people-view-switcher), so view selection does not pass through here.
  const [, setSavedViewId] = useQueryState("view", peopleSavedViewParser);
  const [selectedPersonId, setSelectedPersonId] = useQueryState(
    "person",
    personParser
  );

  const filters = useMemo<PeopleClassificationFilters>(
    () => ({
      memberStatuses: parsePersonMemberStatuses(memberStatusState),
      providers: parsePersonProviders(providerState),
      sources: parsePersonSources(sourceState),
      types: parsePersonTypes(typeState),
    }),
    [memberStatusState, providerState, sourceState, typeState]
  );
  const hasActiveFilters =
    search.length > 0 ||
    filters.memberStatuses.length > 0 ||
    filters.providers.length > 0 ||
    filters.sources.length > 0 ||
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
          void setSavedViewId(null);
          if (group === "provider") {
            void setProviderState("");
          } else if (group === "type") {
            void setTypeState("");
          } else if (group === "source") {
            void setSourceState("");
          } else {
            void setMemberStatusState("");
          }
        }}
        onQueryChange={(value) => void setQuery(value)}
        onToggleProvider={(value) => {
          void setSavedViewId(null);
          void setProviderState(
            serializePersonValues(togglePersonValue(filters.providers, value))
          );
        }}
        onToggleSource={(value) => {
          void setSavedViewId(null);
          void setSourceState(
            serializePersonValues(togglePersonValue(filters.sources, value))
          );
        }}
        onToggleMemberStatus={(value) => {
          void setSavedViewId(null);
          void setMemberStatusState(
            serializePersonValues(
              togglePersonValue(filters.memberStatuses, value)
            )
          );
        }}
        onToggleType={(value) => {
          void setSavedViewId(null);
          void setTypeState(
            serializePersonValues(togglePersonValue(filters.types, value))
          );
        }}
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
